import { supabase } from '@/services/supabase/client'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatBRL, toISODate } from '@/lib/format'
import { splitInstallments } from '@/lib/finance'
import type { LineRow } from './useBudgetData'

/**
 * Executa uma linha do orçamento criando o(s) lançamento(s) no Financeiro, vinculados à linha.
 * Assim o realizado nunca é digitado duas vezes.
 */
export function RealizeDialog({ line, onClose, onSaved }: { line: LineRow | null; onClose: () => void; onSaved: () => void }) {
  const { orgId } = useCurrentOrg()
  const lk = useLookups()
  const remaining = line ? Math.max(Number(line.total_amount) - Number(line.realized_amount ?? 0), 0.01) : 0
  const isRev = line?.kind === 'receita'
  return (
    <ResourceFormDialog open={!!line} onOpenChange={(o) => !o && onClose()} size="lg" submitLabel="Lançar no Financeiro"
      title={isRev ? 'Registrar receita realizada' : 'Registrar despesa realizada'}
      description={line ? <>“{line.description}” — orçado {formatBRL(line.total_amount)}, já realizado {formatBRL(line.realized_amount)}. O lançamento fica vinculado a esta linha.</> : undefined}
      fields={[
        { name: 'amount', label: 'Valor realizado', type: 'money', required: true, min: 0.01, span: 1 },
        { name: 'due_date', label: 'Vencimento (1ª parcela)', type: 'date', required: true, span: 1 },
        { name: 'installments', label: 'Parcelas', type: 'number', min: 1, max: 120, span: 1 },
        { name: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: isRev ? 'Recebido' : 'Pago' }], span: 1 },
        { name: 'paid_date', label: 'Data do pagamento', type: 'date', span: 1, showIf: (v) => v.status === 'pago' },
        { name: 'account_id', label: 'Conta', type: 'select', options: toOptions(lk.accounts.data, (a) => a.name), span: 1 },
        { name: 'document_number', label: 'Nº documento / NF', type: 'text', maxLength: 60, span: 1 },
        { name: 'mark_done', label: 'Marcar linha como realizada', type: 'checkbox', span: 2 },
      ]}
      initial={line ? { amount: remaining, due_date: toISODate(), installments: line.installments ?? 1, status: 'pago', paid_date: toISODate(), mark_done: true } : null}
      refine={(v) => (v.status === 'pago' && v.paid_date && v.paid_date > toISODate() ? 'A data de pagamento não pode ser futura' : null)}
      onSubmit={async (v) => {
        if (!line) return
        const n = Math.max(1, Number(v.installments) || 1)
        const parts = splitInstallments(Number(v.amount), n)
        const group = n > 1 ? crypto.randomUUID() : null
        const due = new Date(`${v.due_date as string}T12:00:00`)
        const rows = parts.map((amt, i) => ({
          organization_id: orgId, farm_id: line.farm_id, season_id: line.season_id, field_id: line.field_id, crop_id: line.crop_id, activity_id: line.activity_id,
          category_id: line.category_id, contact_id: line.contact_id, account_id: v.account_id, kind: line.kind, budget_line_id: line.id,
          description: n > 1 ? `${line.description} — parcela ${i + 1}/${n}` : line.description, amount: amt,
          quantity: n === 1 ? Number(line.quantity) : null, quantity_unit: n === 1 && ['sc', 'kg', 't', '@', 'L', 'un', 'ha', 'h'].includes(line.unit ?? '') ? line.unit : null,
          issue_date: toISODate(), due_date: i === 0 ? v.due_date : toISODate(new Date(due.getFullYear(), due.getMonth() + i, Math.min(due.getDate(), 28))),
          status: i === 0 ? v.status : 'pendente', paid_date: i === 0 && v.status === 'pago' ? (v.paid_date ?? toISODate()) : null,
          payment_method: line.payment_method, document_number: v.document_number, notes: line.notes,
          installment_number: n > 1 ? i + 1 : null, installment_count: n > 1 ? n : null, installment_group: group,
        }))
        const { error } = await supabase.rpc('create_transactions', { p_rows: rows as never })
        if (error) throw error
        if (v.mark_done) {
          const { error: e2 } = await supabase.from('budget_lines').update({ status: 'realizado', actual_date: v.status === 'pago' ? (v.paid_date ?? toISODate()) : toISODate() }).eq('id', line.id)
          if (e2) throw e2
        }
        onSaved()
      }} />
  )
}
