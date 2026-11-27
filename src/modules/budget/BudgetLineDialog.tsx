import { useEffect } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Calculator } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatBRL, toISODate } from '@/lib/format'
import { lineTotal } from '@/lib/budget'
import type { LineRow } from './useBudgetData'
import { EXPENSE_TYPES, STATUS, UNITS } from './config'

const PAYMENT = [
  { value: 'pix', label: 'PIX' }, { value: 'boleto', label: 'Boleto' }, { value: 'transferencia', label: 'Transferência' }, { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' }, { value: 'cheque', label: 'Cheque' }, { value: 'permuta', label: 'Permuta / troca' }, { value: 'outro', label: 'Outro' },
]
const parse = (v: unknown) => Number(String(v ?? '').replace(/\./g, (m, _i, s: string) => (s.includes(',') ? '' : m)).replace(',', '.'))

/** Total calculado ao vivo + preenchimento a partir do estoque */
function LiveTotal({ form, items }: { form: UseFormReturn<Record<string, unknown>>; items: { id: string; unit: string; average_cost: number | null }[] }) {
  const [q, p, item, inst, rec, recN] = useWatch({ control: form.control, name: ['quantity', 'unit_price', 'inventory_item_id', 'installments', 'recurrence', 'recurrence_count'] })
  useEffect(() => {
    if (!item) return
    const it = items.find((x) => x.id === item)
    if (!it) return
    if (!form.getValues('unit')) form.setValue('unit', it.unit)
    if (!form.getValues('unit_price') && it.average_cost) form.setValue('unit_price', String(it.average_cost).replace('.', ','))
  }, [item, items, form])
  const qty = parse(q), price = parse(p)
  const total = Number.isFinite(qty) && Number.isFinite(price) ? lineTotal(qty, price) : null
  const n = Math.max(1, Number(inst) || 1)
  const occurrences = rec && rec !== 'nenhuma' ? Math.max(1, Number(recN) || 1) : 1
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900" aria-live="polite">
      <Calculator className="h-5 w-5 shrink-0" aria-hidden />
      <span>Total: <strong className="text-lg tabular">{total === null ? '—' : formatBRL(total)}</strong></span>
      {total !== null && n > 1 && <span className="text-xs">{n} parcelas de ~{formatBRL(total / n)}</span>}
      {total !== null && occurrences > 1 && <span className="text-xs">× {occurrences} ocorrências = {formatBRL(total * occurrences)}</span>}
      <span className="w-full text-xs text-brand-800/80">Quantidade × valor unitário. O banco recalcula e grava o total.</span>
    </div>
  )
}

export function BudgetLineDialog({ edit, onClose, onSaved, activities }: {
  edit: (Partial<LineRow> & { kind?: string }) | null
  onClose: () => void
  onSaved: () => void
  activities: { id: string; title: string | null; started_at: string; farm_id: string; activity_types: { name: string } | null }[]
}) {
  const { orgId, farmId, farms } = useCurrentOrg()
  const lk = useLookups()
  const kind = edit?.kind ?? 'despesa'
  const farm = edit?.farm_id ?? farmId
  const isRev = kind === 'receita'

  const fields: FieldDef[] = [
    { name: 'description', label: 'Descrição', type: 'text', required: true, maxLength: 240, span: 3, placeholder: isRev ? 'Ex.: Venda da produção de soja' : 'Ex.: Adubo 04-14-08 para plantio' },
    { name: 'category_id', label: 'Categoria', type: 'select', required: true, options: toOptions((lk.categories.data ?? []).filter((c) => c.kind === kind), (c) => c.name), span: 1 },
    { name: 'subcategory', label: 'Subcategoria', type: 'text', maxLength: 80, span: 1, placeholder: 'Opcional' },
    ...(isRev ? [] : [{ name: 'expense_type', label: 'Tipo de despesa', type: 'select' as const, required: true, options: EXPENSE_TYPES, span: 1 as const }]),
    { name: 'quantity', label: isRev ? 'Produção / quantidade' : 'Quantidade', type: 'number', required: true, min: 0.0001, span: 1 },
    { name: 'unit', label: 'Unidade', type: 'select', options: UNITS.map((u) => ({ value: u, label: u })), span: 1 },
    { name: 'unit_price', label: isRev ? 'Preço unitário' : 'Valor unitário', type: 'money', required: true, min: 0, span: 1 },
    { name: 'planned_date', label: 'Data prevista', type: 'date', required: true, span: 1 },
    { name: 'status', label: 'Status', type: 'select', required: true, options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })), span: 1 },
    { name: 'actual_date', label: 'Data efetiva', type: 'date', span: 1, showIf: (v) => v.status === 'realizado' },
    { name: 'farm_id', label: 'Propriedade', type: 'select', required: true, options: farms.map((f) => ({ value: f.id, label: f.name })), span: 1 },
    { name: 'season_id', label: 'Safra', type: 'select', options: toOptions((lk.seasons.data ?? []).filter((x) => !farm || x.farm_id === farm), (x) => x.name), span: 1 },
    { name: 'crop_id', label: 'Cultura', type: 'select', options: toOptions(lk.crops.data, (c) => c.name), span: 1, hint: 'Herdada da safra se vazio' },
    { name: 'field_id', label: 'Talhão', type: 'select', options: toOptions((lk.fields.data ?? []).filter((x) => !farm || x.farm_id === farm), (x) => x.name), span: 1 },
    ...(isRev ? [] : [
      { name: 'activity_id', label: 'Atividade de campo', type: 'select' as const, options: activities.filter((a) => !farm || a.farm_id === farm).map((a) => ({ value: a.id, label: `${a.activity_types?.name ?? 'Atividade'}${a.title ? ` — ${a.title}` : ''} (${a.started_at.slice(8, 10)}/${a.started_at.slice(5, 7)})` })), span: 1 as const },
      { name: 'inventory_item_id', label: 'Item do estoque', type: 'select' as const, options: toOptions(lk.items.data, (i) => `${i.name} (${i.unit})`), span: 1 as const, hint: 'Preenche unidade e custo médio' },
      { name: 'equipment_id', label: 'Máquina / equipamento', type: 'select' as const, options: toOptions(lk.equipment.data, (e) => e.name), span: 1 as const },
    ]),
    { name: 'contact_id', label: isRev ? 'Comprador' : 'Fornecedor', type: 'select', options: toOptions(lk.contacts.data, (c) => c.name), span: 1 },
    { name: 'payment_method', label: 'Forma de pagamento', type: 'select', options: PAYMENT, span: 1 },
    { name: 'payment_terms', label: 'Condição de pagamento', type: 'text', maxLength: 80, span: 1, placeholder: 'Ex.: 30/60/90, safra' },
    { name: 'installments', label: 'Nº de parcelas', type: 'number', min: 1, max: 120, span: 1 },
    ...(edit?.id ? [] : [
      { name: 'recurrence', label: 'Recorrência', type: 'select' as const, options: [{ value: 'nenhuma', label: 'Não se repete' }, { value: 'mensal', label: 'Mensal' }, { value: 'trimestral', label: 'Trimestral' }, { value: 'anual', label: 'Anual' }], span: 1 as const },
      { name: 'recurrence_count', label: 'Nº de ocorrências', type: 'number' as const, min: 1, max: 60, span: 1 as const, showIf: (v: Record<string, unknown>) => !!v.recurrence && v.recurrence !== 'nenhuma' },
    ]),
    ...(isRev ? [] : [{ name: 'is_extraordinary', label: 'Despesa extraordinária', type: 'checkbox' as const, span: 1 as const }]),
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 2000, span: 3 },
  ]

  const save = async (v: Record<string, unknown>) => {
    const { recurrence_count, ...rest } = v
    const row: Record<string, unknown> = { ...rest, kind, expense_type: isRev ? 'receita' : rest.expense_type, installments: Number(rest.installments) || 1, is_extraordinary: !!rest.is_extraordinary }
    if (edit?.id) {
      delete row.recurrence
      const { error } = await supabase.from('budget_lines').update(row as never).eq('id', edit.id)
      if (error) throw error
    } else {
      const step = { nenhuma: 0, mensal: 1, trimestral: 3, anual: 12 }[(row.recurrence as string) || 'nenhuma'] ?? 0
      const count = step ? Math.min(60, Math.max(1, Number(recurrence_count) || 1)) : 1
      const group = count > 1 ? crypto.randomUUID() : null
      const base = new Date(`${row.planned_date as string}T12:00:00`)
      const rows = Array.from({ length: count }, (_, i) => {
        const d = new Date(base.getFullYear(), base.getMonth() + i * step, Math.min(base.getDate(), 28))
        return { ...row, organization_id: orgId, recurrence: row.recurrence || 'nenhuma', recurrence_group: group, planned_date: i === 0 ? row.planned_date : toISODate(d),
          status: i === 0 ? row.status : 'previsto', actual_date: i === 0 ? row.actual_date : null, description: count > 1 ? `${row.description as string} (${i + 1}/${count})` : row.description }
      })
      const { error } = await supabase.rpc('create_budget_lines', { p_rows: rows as never })
      if (error) throw error
    }
    onSaved()
  }

  return (
    <ResourceFormDialog open={!!edit} onOpenChange={(o) => !o && onClose()} size="xl"
      title={edit?.id ? 'Editar linha do orçamento' : isRev ? 'Nova receita prevista' : 'Nova despesa orçada'}
      description={isRev ? 'Produção esperada × preço. Base para resultado, margem e ponto de equilíbrio.' : 'Cada linha detalha um gasto previsto. O realizado vem do Financeiro.'}
      fields={fields} initial={edit} onSubmit={save}
      defaults={{ status: 'previsto', planned_date: toISODate(), farm_id: farmId ?? farms[0]?.id, quantity: 1, installments: 1, expense_type: 'custeio', recurrence: 'nenhuma', unit: isRev ? 'sc' : 'un' }}
      refine={(v) => (v.status === 'realizado' && v.actual_date && v.actual_date > toISODate() ? 'A data efetiva não pode ser futura' : null)}
      extra={(form) => <LiveTotal form={form} items={(lk.items.data ?? []) as { id: string; unit: string; average_cost: number | null }[]} />} />
  )
}
