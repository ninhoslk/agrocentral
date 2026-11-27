import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Plus, Receipt, Wallet } from 'lucide-react'
import { Bar, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { FilterPanel } from '@/components/ui/FilterPanel'
import { Badge, Button, Card, CardHeader, FieldWrap, Input, Select, Tabs } from '@/components/ui/primitives'
import { useConfirm } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { addDays, formatBRL, formatDate, formatNumber, formatPct, toISODate } from '@/lib/format'
import { byCategory, monthlyCashflow, splitInstallments, summarize } from '@/lib/finance'
import { toUserMessage } from '@/lib/errors'
import { ContactsTable } from './ContactsTable'

const SITUATION = {
  pago: { label: 'Pago', tone: 'green' }, cancelado: { label: 'Cancelado', tone: 'neutral' }, vencido: { label: 'Vencido', tone: 'red' },
  vence_em_breve: { label: 'Vence em breve', tone: 'yellow' }, em_aberto: { label: 'Em aberto', tone: 'blue' },
} as const
const PAYMENT = ['pix', 'boleto', 'transferencia', 'dinheiro', 'cartao', 'cheque', 'permuta', 'outro'].map((v) => ({ value: v, label: v === 'pix' ? 'PIX' : v[0].toUpperCase() + v.slice(1).replace('transferencia', 'Transferência') }))

interface Tx {
  id: string; kind: string; description: string; amount: number; due_date: string; paid_date: string | null; issue_date: string; status: string; situation: keyof typeof SITUATION
  category_name: string; category_id: string; farm_id: string | null; season_id: string | null; field_id: string | null; contact_id: string | null; account_id: string | null
  cost_center_id: string | null; crop_id: string | null; budget_line_id: string | null; payment_method: string | null; document_number: string | null; installment_number: number | null; installment_count: number | null
  notes: string | null; is_demo: boolean; quantity: number | null; quantity_unit: string | null
}

export function FinancePage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'resumo' | 'lancamentos' | 'pagar' | 'receber' | 'cadastros'>('resumo')
  const [edit, setEdit] = useState<Partial<Tx> & { kind?: string } | null>(null)
  const [period, setPeriod] = useState({ from: toISODate(new Date(new Date().getFullYear(), 0, 1)), to: toISODate(new Date(new Date().getFullYear(), 11, 31)) })
  const [seasonFilter, setSeasonFilter] = useState('')
  const { confirm, node } = useConfirm()
  const qc = useQueryClient()

  useEffect(() => {
    const n = params.get('novo')
    if (n === 'despesa' || n === 'receita') setEdit({ kind: n })
    if (params.get('q')) setTab('lancamentos')
  }, [params])

  const q = useQuery({
    queryKey: ['transactions', orgId, farmId, period, seasonFilter],
    queryFn: () => {
      let qb = supabase.from('transactions_v').select('*').eq('organization_id', orgId).is('archived_at', null)
        .gte('due_date', period.from).lte('due_date', period.to).order('due_date', { ascending: false }).limit(2000)
      if (farmId) qb = qb.eq('farm_id', farmId)
      if (seasonFilter) qb = qb.eq('season_id', seasonFilter)
      return unwrap(qb) as unknown as Promise<Tx[]>
    },
  })
  // contas em aberto independem do período
  const open = useQuery({
    queryKey: ['transactions', 'open', orgId, farmId],
    queryFn: () => { let qb = supabase.from('transactions_v').select('*').eq('organization_id', orgId).eq('status', 'pendente').is('archived_at', null).order('due_date'); if (farmId) qb = qb.eq('farm_id', farmId); return unwrap(qb) as unknown as Promise<Tx[]> },
  })
  const accounts = useQuery({ queryKey: ['fin-accounts', orgId], enabled: tab === 'cadastros' || tab === 'resumo', queryFn: () => unwrap(supabase.from('financial_accounts').select('*').eq('organization_id', orgId).is('archived_at', null).order('name')) })
  const paidByAccount = useQuery({ queryKey: ['fin-account-balances', orgId], enabled: tab === 'cadastros', queryFn: () => unwrap(supabase.from('transactions').select('account_id, kind, amount').eq('organization_id', orgId).eq('status', 'pago')) })

  const inval = [['transactions'], ['dashboard'], ['fin-account-balances'], ['season-txs'], ['budget-lines'], ['budget-actuals']]
  const markPaid = useAppMutation(async (t: Tx) => unwrap(supabase.from('transactions').update({ status: 'pago', paid_date: toISODate() }).eq('id', t.id)), { invalidate: inval, success: 'Baixa registrada' })
  const cancel = useAppMutation(async (t: Tx) => unwrap(supabase.from('transactions').update({ status: 'cancelado' }).eq('id', t.id)), { invalidate: inval, success: 'Lançamento cancelado' })
  const saveAccount = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('financial_accounts').insert({ ...v, organization_id: orgId } as never)), { invalidate: [['fin-accounts'], ['lk-accounts']] })
  const saveCC = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('cost_centers').insert({ ...v, organization_id: orgId } as never)), { invalidate: [['lk-cost-centers']] })
  const saveCat = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('financial_categories').insert({ ...v, organization_id: orgId } as never)), { invalidate: [['lk-fin-categories']] })
  const [accOpen, setAccOpen] = useState(false)
  const [ccOpen, setCcOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)

  const today = toISODate()
  const txs = q.data ?? []
  const s = useMemo(() => summarize(txs, today), [txs, today])
  const flow = useMemo(() => monthlyCashflow(txs).map((m) => ({ ...m, label: `${m.month.slice(5)}/${m.month.slice(2, 4)}` })), [txs])
  const cats = useMemo(() => byCategory(txs, 'despesa'), [txs])
  const area = useMemo(() => farms.filter((f) => !farmId || f.id === farmId).reduce((a, f) => a + Number(f.total_area_ha ?? 0), 0), [farms, farmId])

  const kindOf = edit?.kind ?? 'despesa'
  const txFields = (farm?: string | null): FieldDef[] => [
    { name: 'kind', label: 'Tipo', type: 'select', required: true, options: [{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }], span: 1, disabled: true, hint: 'Definido pelo botão escolhido' },
    { name: 'description', label: 'Descrição', type: 'text', required: true, maxLength: 240, span: 2 },
    { name: 'category_id', label: 'Categoria', type: 'select', required: true, options: toOptions((lk.categories.data ?? []).filter((c) => c.kind === kindOf), (c) => c.name), span: 1 },
    { name: 'amount', label: 'Valor total', type: 'money', required: true, min: 0.01, span: 1 },
    { name: 'contact_id', label: kindOf === 'receita' ? 'Cliente' : 'Fornecedor', type: 'select', options: toOptions(lk.contacts.data, (c) => c.name), span: 1 },
    { name: 'issue_date', label: 'Emissão', type: 'date', span: 1 },
    { name: 'due_date', label: edit?.id ? 'Vencimento' : 'Vencimento (1ª parcela)', type: 'date', required: true, span: 1 },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: kindOf === 'receita' ? 'Recebido' : 'Pago' }, { value: 'cancelado', label: 'Cancelado' }], span: 1 },
    { name: 'paid_date', label: 'Data do pagamento', type: 'date', span: 1, showIf: (v) => v.status === 'pago' },
    ...(edit?.id ? [] : [
      { name: 'installments', label: 'Parcelas', type: 'number' as const, min: 1, max: 120, span: 1 as const, hint: 'Valor dividido em parcelas mensais' },
      { name: 'recurrence', label: 'Recorrência', type: 'select' as const, options: [{ value: 'mensal', label: 'Repetir mensalmente (valor cheio)' }], span: 1 as const, emptyOption: 'Sem recorrência', hint: 'Cria 12 lançamentos' },
    ]),
    { name: 'payment_method', label: 'Forma de pagamento', type: 'select', options: PAYMENT, span: 1 },
    { name: 'account_id', label: 'Conta', type: 'select', options: toOptions(lk.accounts.data, (a) => a.name), span: 1 },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), span: 1 },
    { name: 'season_id', label: 'Safra', type: 'select', options: toOptions((lk.seasons.data ?? []).filter((x) => !farm || x.farm_id === farm), (x) => x.name), span: 1 },
    { name: 'field_id', label: 'Talhão', type: 'select', options: toOptions((lk.fields.data ?? []).filter((x) => !farm || x.farm_id === farm), (x) => x.name), span: 1 },
    { name: 'crop_id', label: 'Cultura', type: 'select', options: toOptions(lk.crops.data, (c) => c.name), span: 1 },
    ...(can('budget') ? [{ name: 'budget_line_id', label: 'Linha do orçamento', type: 'select' as const, span: 2 as const, hint: 'Vincula este lançamento ao orçado (MICRO) para comparar orçado × realizado',
      options: toOptions((lk.budgetLines.data ?? []).filter((b) => b.kind === kindOf && (!farm || !b.farm_id || b.farm_id === farm)), (b) => `${b.description} — ${formatBRL(b.total_amount)}`) }] : []),
    { name: 'cost_center_id', label: 'Centro de custo', type: 'select', options: toOptions(lk.costCenters.data, (c) => c.name), span: 1 },
    { name: 'quantity', label: 'Quantidade', type: 'number', min: 0, span: 1, hint: 'Ex.: sacas vendidas' },
    { name: 'quantity_unit', label: 'Unidade', type: 'select', options: ['sc', 'kg', 't', '@', 'L', 'un', 'ha', 'h'].map((u) => ({ value: u, label: u })), span: 1 },
    { name: 'document_number', label: 'Nº documento / NF', type: 'text', maxLength: 60, span: 1 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 2000, span: 3 },
  ]

  const saveTx = async (v: Record<string, unknown>) => {
    if (!edit?.id) v.kind = kindOf
    if (v.status === 'pago' && !v.paid_date) v.paid_date = toISODate()
    if (edit?.id) {
      const { installments: _i, recurrence: _r, ...rest } = v; void _i; void _r
      const { error } = await supabase.from('transactions').update(rest as never).eq('id', edit.id)
      if (error) throw error
    } else {
      const n = v.recurrence === 'mensal' ? 12 : Math.max(1, Number(v.installments ?? 1))
      const amounts = v.recurrence === 'mensal' ? Array(12).fill(Number(v.amount)) : splitInstallments(Number(v.amount), n)
      const group = n > 1 ? crypto.randomUUID() : null
      const base = { ...v, organization_id: orgId }
      delete (base as Record<string, unknown>).installments
      delete (base as Record<string, unknown>).recurrence
      const due = new Date(`${v.due_date as string}T12:00:00`)
      const rows = amounts.map((amt, i) => {
        const d = new Date(due.getFullYear(), due.getMonth() + i, Math.min(due.getDate(), 28))
        return {
          ...base, amount: amt, due_date: i === 0 ? v.due_date : toISODate(d),
          description: n > 1 && v.recurrence !== 'mensal' ? `${v.description as string} — parcela ${i + 1}/${n}` : v.description,
          status: i === 0 ? v.status : 'pendente', paid_date: i === 0 ? v.paid_date : null,
          installment_number: n > 1 ? i + 1 : null, installment_count: n > 1 ? n : null, installment_group: group,
        }
      })
      const { error } = await supabase.rpc('create_transactions', { p_rows: rows as never })
      if (error) throw error
    }
    inval.forEach((k) => qc.invalidateQueries({ queryKey: k }))
  }

  const cols: Column<Tx>[] = [
    { key: 'due', header: 'Vencimento', sortable: true, value: (r) => r.due_date, cell: (r) => formatDate(r.due_date) },
    { key: 'desc', header: 'Descrição', primary: true, sortable: true, value: (r) => r.description, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.description}<DemoBadge show={r.is_demo} /></span> },
    { key: 'cat', header: 'Categoria', sortable: true, value: (r) => r.category_name, cell: (r) => r.category_name },
    { key: 'kind', header: 'Tipo', value: (r) => (r.kind === 'receita' ? 'Receita' : 'Despesa'), cell: (r) => <Badge tone={r.kind === 'receita' ? 'green' : 'red'}>{r.kind === 'receita' ? 'Receita' : 'Despesa'}</Badge> },
    { key: 'amount', header: 'Valor', align: 'right', sortable: true, value: (r) => Number(r.amount) * (r.kind === 'despesa' ? -1 : 1), cell: (r) => <span className={r.kind === 'despesa' ? 'text-danger' : 'text-ok'}>{r.kind === 'despesa' ? '−' : '+'}{formatBRL(r.amount)}</span> },
    { key: 'sit', header: 'Situação', value: (r) => SITUATION[r.situation].label, cell: (r) => <Badge tone={SITUATION[r.situation].tone}>{SITUATION[r.situation].label}</Badge> },
    { key: 'paid', header: 'Pagamento', hidden: true, value: (r) => r.paid_date, cell: (r) => formatDate(r.paid_date) },
    { key: 'act', header: '', align: 'right', cell: (r) => can('finance', 'edit') && r.status === 'pendente' ? (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); markPaid.mutate(r) }}><CheckCircle2 className="h-4 w-4" />{r.kind === 'receita' ? 'Receber' : 'Pagar'}</Button>) : null },
  ]

  const search = params.get('q') ?? ''
  const filteredTx = search ? txs.filter((t) => t.description.toLowerCase().includes(search.toLowerCase())) : txs
  return (
    <>
      <PageHeader title="Financeiro" crumbs={[{ label: 'Gestão' }, { label: 'Financeiro' }]}
        description="Receitas, despesas, contas a pagar e a receber. Indicadores calculados a partir dos lançamentos persistidos."
        actions={can('finance', 'create') && <>
          <Button variant="outline" onClick={() => setEdit({ kind: 'receita' })}><Plus className="h-4 w-4" />Receita</Button>
          <Button onClick={() => setEdit({ kind: 'despesa' })}><Receipt className="h-4 w-4" />Despesa</Button>
        </>} />
      <FilterPanel gridClassName="flex flex-wrap items-end gap-3" summary={`Vencimento ${formatDate(period.from)} a ${formatDate(period.to)}${seasonFilter ? ` · ${lk.seasons.data?.find((x) => x.id === seasonFilter)?.name ?? ''}` : ''}`}>
        <FieldWrap label="Vencimento de" htmlFor="p-from"><Input id="p-from" type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} /></FieldWrap>
        <FieldWrap label="até" htmlFor="p-to"><Input id="p-to" type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></FieldWrap>
        <FieldWrap label="Safra" htmlFor="p-season"><Select id="p-season" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className="min-w-48"><option value="">Todas</option>{lk.seasons.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></FieldWrap>
        <div className="flex gap-1 pb-0.5">
          {[{ l: 'Este mês', f: toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: toISODate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)) },
            { l: '12 meses', f: toISODate(addDays(new Date(), -365)), t: toISODate(addDays(new Date(), 30)) },
            { l: 'Ano', f: toISODate(new Date(new Date().getFullYear(), 0, 1)), t: toISODate(new Date(new Date().getFullYear(), 11, 31)) }].map((p) => (
            <Button key={p.l} variant="ghost" size="sm" onClick={() => setPeriod({ from: p.f, to: p.t })}>{p.l}</Button>
          ))}
        </div>
      </FilterPanel>
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[
        { value: 'resumo', label: 'Resumo' }, { value: 'lancamentos', label: 'Lançamentos', count: txs.length },
        { value: 'pagar', label: 'Contas a pagar', count: open.data?.filter((t) => t.kind === 'despesa').length },
        { value: 'receber', label: 'Contas a receber', count: open.data?.filter((t) => t.kind === 'receita').length },
        { value: 'cadastros', label: 'Contas, centros e contatos' },
      ]} />

      {tab === 'resumo' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Receitas (período)" value={formatBRL(s.revenue)} tone="good" />
            <StatCard label="Despesas (período)" value={formatBRL(s.expense)} tone="bad" />
            <StatCard label="Resultado" value={formatBRL(s.result)} tone={s.result >= 0 ? 'good' : 'bad'} hint={s.marginPct !== null ? `Margem ${formatPct(s.marginPct)}` : undefined} />
            <StatCard label="Caixa realizado" value={formatBRL(s.cashBalance)} hint="Recebido − pago no período" />
            <StatCard label="A pagar (período)" value={formatBRL(s.payable)} hint={s.overduePayable ? <span className="text-danger">Vencido: {formatBRL(s.overduePayable)}</span> : 'Nada vencido'} />
            <StatCard label="A receber (período)" value={formatBRL(s.receivable)} hint={s.overdueReceivable ? <span className="text-danger">Atrasado: {formatBRL(s.overdueReceivable)}</span> : undefined} />
            <StatCard label="Custo por hectare" value={area ? formatBRL(s.expense / area) : '—'} hint={area ? `Área considerada: ${formatNumber(area)} ha` : 'Informe a área total das propriedades'} />
            <StatCard label="Ponto de equilíbrio" value={s.revenue > 0 ? formatPct((s.expense / s.revenue) * 100 - 100) : '—'} hint={s.revenue > 0 ? (s.expense <= s.revenue ? 'Receitas cobrem as despesas' : 'Receitas insuficientes no período') : 'Sem receitas no período'} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader title="Fluxo de caixa mensal" description="Previsto pelo vencimento; realizado pela data de pagamento. Valores em R$." />
              <div className="h-72 p-4">
                {flow.length ? (
                  <ResponsiveContainer>
                    <ComposedChart data={flow}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${formatNumber(v / 1000, 0)} mil`} width={64} />
                      <Tooltip formatter={(v) => formatBRL(Number(v))} />
                      <Legend />
                      <Bar dataKey="receitas" name="Receitas" fill="#3b8250" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="#b42318" radius={[4, 4, 0, 0]} />
                      <Line dataKey="saldo" name="Saldo do mês" stroke="#14532d" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="Sem lançamentos no período" />}
              </div>
            </Card>
            <Card>
              <CardHeader title="Despesas por categoria" />
              <div className="p-4">
                {cats.length ? (
                  <ul className="space-y-3">
                    {cats.slice(0, 8).map((c) => {
                      const pct = s.expense ? (c.value / s.expense) * 100 : 0
                      return (
                        <li key={c.name}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate">{c.name}</span>
                            <span className="shrink-0 tabular"><span className="font-medium">{formatBRL(c.value)}</span> <span className="text-xs text-muted">{formatNumber(pct, 0)}%</span></span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-black/[0.06]" aria-hidden><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(pct, 1)}%` }} /></div>
                        </li>
                      )
                    })}
                    {cats.length > 8 && <li className="text-xs text-muted">+ {cats.length - 8} categorias menores</li>}
                  </ul>
                ) : <EmptyState title="Sem despesas no período" />}
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === 'lancamentos' && <DataTable rows={filteredTx} columns={cols} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} onRowClick={(r) => can('finance', 'edit') && setEdit(r)}
        exportName="Lançamentos financeiros" initialSort={{ key: 'due', dir: 'desc' }}
        toolbar={search ? <Button variant="ghost" size="sm" onClick={() => { params.delete('q'); setParams(params) }}>Limpar busca “{search}”</Button> : undefined}
        empty={<EmptyState icon={<Wallet className="h-6 w-6" />} title="Nenhum lançamento no período" description="Registre receitas e despesas para acompanhar o resultado." />} />}
      {(tab === 'pagar' || tab === 'receber') && <DataTable rows={(open.data ?? []).filter((t) => t.kind === (tab === 'pagar' ? 'despesa' : 'receita'))} columns={cols} loading={open.isLoading} error={open.error}
        onRowClick={(r) => can('finance', 'edit') && setEdit(r)} exportName={tab === 'pagar' ? 'Contas a pagar' : 'Contas a receber'} initialSort={{ key: 'due', dir: 'asc' }}
        empty={<EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nada em aberto" />} />}
      {tab === 'cadastros' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contas financeiras" description="Saldo = saldo inicial + recebimentos − pagamentos registrados na conta." actions={can('finance', 'create') && <Button size="sm" onClick={() => setAccOpen(true)}><Plus className="h-4 w-4" />Nova conta</Button>} />
            <ul className="divide-y divide-line">
              {(accounts.data ?? []).map((a) => {
                const mov = (paidByAccount.data ?? []).filter((t) => t.account_id === a.id).reduce((s2, t) => s2 + (t.kind === 'receita' ? 1 : -1) * Number(t.amount), 0)
                return <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm"><span className="flex items-center gap-2">{a.name}<DemoBadge show={a.is_demo} /></span><span className="tabular font-medium">{formatBRL(Number(a.initial_balance) + mov)}</span></li>
              })}
              {!accounts.data?.length && <li className="px-5 py-6 text-center text-sm text-muted">Nenhuma conta cadastrada.</li>}
            </ul>
          </Card>
          <div className="flex flex-wrap gap-2">
            {can('finance', 'create') && <Button variant="outline" size="sm" onClick={() => setCcOpen(true)}><Plus className="h-4 w-4" />Centro de custo</Button>}
            {can('finance', 'create') && <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}><Plus className="h-4 w-4" />Categoria personalizada</Button>}
            <span className="self-center text-xs text-muted">Centros: {(lk.costCenters.data ?? []).map((c) => c.name).join(', ') || 'nenhum'}</span>
          </div>
          <ContactsTable module="finance" />
        </div>
      )}

      <TxDialog edit={edit} onClose={() => { setEdit(null); if (params.get('novo')) { params.delete('novo'); setParams(params, { replace: true }) } }}
        fields={txFields(edit?.farm_id ?? farmId)} onSubmit={async (v) => { try { await saveTx(v) } catch (e) { throw new Error(toUserMessage(e)) } }}
        onCancelTx={edit?.id && edit.status !== 'cancelado' && can('finance', 'edit') ? async () => { if (await confirm('Cancelar lançamento?', 'O lançamento permanece no histórico com situação “cancelado” e deixa de compor os totais.', 'Cancelar lançamento')) { cancel.mutate(edit as Tx); setEdit(null) } } : undefined}
        defaults={{ kind: kindOf, status: 'pendente', due_date: toISODate(), issue_date: toISODate(), farm_id: farmId, installments: 1 }} />
      <ResourceFormDialog open={accOpen} onOpenChange={setAccOpen} title="Nova conta financeira" size="md" fields={[
        { name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 80, span: 2 },
        { name: 'kind', label: 'Tipo', type: 'select', required: true, options: [{ value: 'conta_corrente', label: 'Conta corrente' }, { value: 'caixa', label: 'Caixa' }, { value: 'poupanca', label: 'Poupança' }, { value: 'cartao', label: 'Cartão' }, { value: 'investimento', label: 'Investimento' }, { value: 'outro', label: 'Outro' }], span: 1 },
        { name: 'bank', label: 'Banco', type: 'text', maxLength: 80, span: 2 },
        { name: 'initial_balance', label: 'Saldo inicial', type: 'money', span: 1 },
      ]} defaults={{ kind: 'conta_corrente', initial_balance: 0 }} onSubmit={(v) => saveAccount.mutateAsync(v)} />
      <ResourceFormDialog open={ccOpen} onOpenChange={setCcOpen} title="Novo centro de custo" size="md" fields={[{ name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 80, span: 3 }]} onSubmit={(v) => saveCC.mutateAsync(v)} />
      <ResourceFormDialog open={catOpen} onOpenChange={setCatOpen} title="Nova categoria" size="md" fields={[
        { name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 80, span: 2 },
        { name: 'kind', label: 'Tipo', type: 'select', required: true, options: [{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }], span: 1 },
      ]} defaults={{ kind: 'despesa' }} onSubmit={(v) => saveCat.mutateAsync(v)} />
      {node}
    </>
  )
}

function TxDialog({ edit, onClose, fields, onSubmit, defaults, onCancelTx }: {
  edit: Record<string, unknown> | null; onClose: () => void; fields: FieldDef[]; onSubmit: (v: Record<string, unknown>) => Promise<void>
  defaults: Record<string, unknown>; onCancelTx?: () => void
}) {
  return (
    <ResourceFormDialog open={!!edit} onOpenChange={(o) => !o && onClose()} title={edit?.id ? 'Editar lançamento' : edit?.kind === 'receita' ? 'Nova receita' : 'Nova despesa'}
      fields={fields} initial={edit} defaults={defaults} size="xl"
      onSubmit={async (v) => { try { await onSubmit(v) } catch (e) { toast.error((e as Error).message); throw Object.assign(new Error((e as Error).message), { __toasted: true }) } }}
      refine={(v) => (v.status === 'pago' && v.paid_date && v.paid_date > toISODate() ? 'A data de pagamento não pode ser futura' : null)}
      extra={() => onCancelTx ? <Button variant="outline" className="text-danger" onClick={onCancelTx}>Cancelar lançamento</Button> : null} />
  )
}
