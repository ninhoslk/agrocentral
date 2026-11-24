import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Button, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { addDays, formatBRL, formatNumber, toISODate } from '@/lib/format'
import { monthlyCashflow } from '@/lib/finance'

type Report = 'producao' | 'custos_categoria' | 'custos_safra' | 'receitas' | 'insumos' | 'maquinas' | 'tarefas' | 'fluxo'
const REPORTS: { id: Report; label: string; module: string }[] = [
  { id: 'producao', label: 'Produção e produtividade por safra/talhão', module: 'seasons' },
  { id: 'custos_categoria', label: 'Despesas por categoria', module: 'finance' },
  { id: 'custos_safra', label: 'Custos e margem por safra', module: 'finance' },
  { id: 'receitas', label: 'Receitas por categoria e cliente', module: 'finance' },
  { id: 'insumos', label: 'Consumo de insumos', module: 'inventory' },
  { id: 'maquinas', label: 'Uso e custo de máquinas', module: 'equipment' },
  { id: 'tarefas', label: 'Execução de tarefas', module: 'tasks' },
  { id: 'fluxo', label: 'Fluxo de caixa mensal', module: 'finance' },
]
type Row = Record<string, string | number | null>

export function ReportsPage() {
  const { orgId, farmId, can, moduleEnabled, org, farm } = useCurrentOrg()
  const available = REPORTS.filter((r) => moduleEnabled(r.module) && can(r.module))
  const [rep, setRep] = useState<Report>(available[0]?.id ?? 'producao')
  const [from, setFrom] = useState(toISODate(addDays(new Date(), -365)))
  const [to, setTo] = useState(toISODate())

  const q = useQuery({
    queryKey: ['report', rep, orgId, farmId, from, to],
    queryFn: async (): Promise<Row[]> => {
      const f = <T extends { eq: (c: string, v: string) => T }>(qb: T, col = 'farm_id') => (farmId ? qb.eq(col, farmId) : qb)
      switch (rep) {
        case 'producao': {
          const rows = await unwrap(f(supabase.from('harvest_records').select('quantity_kg, harvest_date, seasons(name, crops(name, sack_weight_kg)), fields(name, area_ha, manual_area_ha)').eq('organization_id', orgId).gte('harvest_date', from).lte('harvest_date', to)))
          const m = new Map<string, Row & { kg: number; area: number; sk: number | null }>()
          for (const r of rows) {
            const s = r.seasons as { name: string; crops: { name: string; sack_weight_kg: number | null } | null } | null
            const fl = r.fields as { name: string; area_ha: number | null; manual_area_ha: number | null } | null
            const k = `${s?.name}|${fl?.name}`
            const cur = m.get(k) ?? { Safra: s?.name ?? '', Cultura: s?.crops?.name ?? '', Talhão: fl?.name ?? '', kg: 0, area: Number(fl?.area_ha ?? fl?.manual_area_ha ?? 0), sk: s?.crops?.sack_weight_kg ? Number(s.crops.sack_weight_kg) : null }
            cur.kg += Number(r.quantity_kg ?? 0)
            m.set(k, cur)
          }
          return [...m.values()].map(({ kg, area, sk, ...rest }) => ({ ...rest, 'Área (ha)': Number(area.toFixed(2)), 'Produção (t)': Number((kg / 1000).toFixed(2)), 'Produção (sc)': sk ? Math.round(kg / sk) : null, 'Produtividade (sc/ha)': sk && area ? Number((kg / sk / area).toFixed(1)) : null }))
        }
        case 'custos_categoria':
        case 'receitas': {
          const kind = rep === 'receitas' ? 'receita' : 'despesa'
          const rows = await unwrap(f(supabase.from('transactions_v').select('category_name, amount, status, contacts:contact_id(name)').eq('organization_id', orgId).eq('kind', kind).neq('status', 'cancelado').gte('due_date', from).lte('due_date', to)))
          const m = new Map<string, { total: number; paid: number; n: number }>()
          for (const r of rows as unknown as { category_name: string; amount: number; status: string; contacts: { name: string } | null }[]) {
            const k = rep === 'receitas' ? `${r.category_name}|${r.contacts?.name ?? 'Sem cliente'}` : r.category_name
            const cur = m.get(k) ?? { total: 0, paid: 0, n: 0 }
            cur.total += Number(r.amount); cur.n++; if (r.status === 'pago') cur.paid += Number(r.amount)
            m.set(k, cur)
          }
          const total = [...m.values()].reduce((s, x) => s + x.total, 0)
          return [...m.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => {
            const [cat, who] = k.split('|')
            return { Categoria: cat, ...(rep === 'receitas' ? { Cliente: who } : {}), Lançamentos: v.n, 'Total (R$)': Number(v.total.toFixed(2)), 'Realizado (R$)': Number(v.paid.toFixed(2)), '% do total': total ? Number(((v.total / total) * 100).toFixed(1)) : 0 }
          })
        }
        case 'custos_safra': {
          let sq = supabase.from('seasons').select('id, name, crops(name, sack_weight_kg), season_fields(planted_area_ha)').eq('organization_id', orgId)
          if (farmId) sq = sq.eq('farm_id', farmId)
          const seasons = await unwrap(sq)
          const ids = seasons.map((s) => s.id)
          if (!ids.length) return []
          const [acts, txs, hv] = await Promise.all([
            unwrap(supabase.from('activities').select('season_id, labor_cost, other_cost, inputs_cost').in('season_id', ids).neq('status', 'cancelada')),
            unwrap(supabase.from('transactions').select('season_id, kind, amount').in('season_id', ids).neq('status', 'cancelado')),
            unwrap(supabase.from('harvest_records').select('season_id, quantity_kg').in('season_id', ids)),
          ])
          return seasons.map((s) => {
            const area = (s.season_fields as { planted_area_ha: number | null }[]).reduce((a, x) => a + Number(x.planted_area_ha ?? 0), 0)
            const op = acts.filter((a) => a.season_id === s.id).reduce((a, x) => a + Number(x.labor_cost) + Number(x.other_cost) + Number(x.inputs_cost), 0)
            const exp = txs.filter((t) => t.season_id === s.id && t.kind === 'despesa').reduce((a, x) => a + Number(x.amount), 0)
            const rev = txs.filter((t) => t.season_id === s.id && t.kind === 'receita').reduce((a, x) => a + Number(x.amount), 0)
            const kg = hv.filter((h) => h.season_id === s.id).reduce((a, x) => a + Number(x.quantity_kg ?? 0), 0)
            const crop = s.crops as { name: string; sack_weight_kg: number | null } | null
            const sacks = crop?.sack_weight_kg ? kg / Number(crop.sack_weight_kg) : null
            const cost = op + exp
            return { Safra: s.name, Cultura: crop?.name ?? '', 'Área (ha)': Number(area.toFixed(2)), 'Custo (R$)': Number(cost.toFixed(2)), 'Custo/ha (R$)': area ? Number((cost / area).toFixed(2)) : null, 'Custo/saca (R$)': sacks ? Number((cost / sacks).toFixed(2)) : null, 'Receita (R$)': Number(rev.toFixed(2)), 'Margem (R$)': Number((rev - cost).toFixed(2)) }
          })
        }
        case 'insumos': {
          const rows = await unwrap(f(supabase.from('stock_movements').select('quantity, total_cost, inventory_items(name, unit, category), fields(name), seasons(name)').eq('organization_id', orgId).eq('kind', 'saida').gte('occurred_at', `${from}T00:00:00`).lte('occurred_at', `${to}T23:59:59`)))
          const m = new Map<string, Row & { q: number; c: number }>()
          for (const r of rows) {
            const it = r.inventory_items as { name: string; unit: string; category: string } | null
            const k = `${it?.name}|${(r.seasons as { name: string } | null)?.name ?? ''}`
            const cur = m.get(k) ?? { Insumo: it?.name ?? '', Categoria: it?.category ?? '', Safra: (r.seasons as { name: string } | null)?.name ?? '—', Unidade: it?.unit ?? '', q: 0, c: 0 }
            cur.q += Number(r.quantity); cur.c += Number(r.total_cost ?? 0)
            m.set(k, cur)
          }
          return [...m.values()].map(({ q: qty, c, ...rest }) => ({ ...rest, Quantidade: Number(qty.toFixed(3)), 'Custo (R$)': Number(c.toFixed(2)) }))
        }
        case 'maquinas': {
          let eq = supabase.from('equipment').select('id, name, kind, hour_meter').eq('organization_id', orgId).is('archived_at', null)
          if (farmId) eq = eq.or(`farm_id.eq.${farmId},farm_id.is.null`)
          const [eqs, use, mt] = await Promise.all([
            unwrap(eq),
            unwrap(supabase.from('equipment_usage').select('equipment_id, hours, fuel_liters, fuel_cost').eq('organization_id', orgId).gte('usage_date', from).lte('usage_date', to)),
            unwrap(supabase.from('maintenance_records').select('equipment_id, total_cost').eq('organization_id', orgId).eq('status', 'concluida').gte('performed_date', from).lte('performed_date', to)),
          ])
          return eqs.map((e) => {
            const u = use.filter((x) => x.equipment_id === e.id)
            const h = u.reduce((a, x) => a + Number(x.hours ?? 0), 0), l = u.reduce((a, x) => a + Number(x.fuel_liters ?? 0), 0), fc = u.reduce((a, x) => a + Number(x.fuel_cost ?? 0), 0)
            const mc = mt.filter((x) => x.equipment_id === e.id).reduce((a, x) => a + Number(x.total_cost), 0)
            return { Equipamento: e.name, Tipo: e.kind, 'Horímetro': Number(e.hour_meter), 'Horas no período': Number(h.toFixed(1)), 'Combustível (L)': Number(l.toFixed(0)), 'L/h': h ? Number((l / h).toFixed(1)) : null, 'Combustível (R$)': Number(fc.toFixed(2)), 'Manutenção (R$)': Number(mc.toFixed(2)), 'Custo/h (R$)': h ? Number(((fc + mc) / h).toFixed(2)) : null }
          })
        }
        case 'tarefas': {
          const rows = await unwrap(f(supabase.from('tasks').select('status, due_date, completed_at, employees(full_name)').eq('organization_id', orgId).gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)))
          const m = new Map<string, { total: number; done: number; late: number; open: number }>()
          const today = toISODate()
          for (const r of rows) {
            const k = (r.employees as { full_name: string } | null)?.full_name ?? 'Sem responsável'
            const cur = m.get(k) ?? { total: 0, done: 0, late: 0, open: 0 }
            cur.total++
            if (r.status === 'concluida') { cur.done++; if (r.due_date && r.completed_at && r.completed_at.slice(0, 10) > r.due_date) cur.late++ }
            else if (r.status !== 'cancelada') { cur.open++; if (r.due_date && r.due_date < today) cur.late++ }
            m.set(k, cur)
          }
          return [...m.entries()].map(([k, v]) => ({ Responsável: k, Tarefas: v.total, Concluídas: v.done, 'Em aberto': v.open, 'Com atraso': v.late, '% concluídas': v.total ? Number(((v.done / v.total) * 100).toFixed(0)) : 0 }))
        }
        case 'fluxo': {
          const rows = await unwrap(f(supabase.from('transactions').select('kind, amount, status, due_date, paid_date').eq('organization_id', orgId).gte('due_date', from).lte('due_date', to)))
          let acc = 0
          return monthlyCashflow(rows).map((m) => { acc += m.saldo; return { Mês: m.month, 'Receitas (R$)': Number(m.receitas.toFixed(2)), 'Despesas (R$)': Number(m.despesas.toFixed(2)), 'Saldo (R$)': Number(m.saldo.toFixed(2)), 'Acumulado (R$)': Number(acc.toFixed(2)) } })
        }
      }
    },
  })

  const columns: Column<Row>[] = useMemo(() => {
    const keys = Object.keys(q.data?.[0] ?? {})
    return keys.map((k, i) => ({
      key: k, header: k, sortable: true, primary: i === 0, align: typeof q.data?.[0]?.[k] === 'number' ? 'right' : 'left',
      value: (r: Row) => r[k], cell: (r: Row) => { const v = r[k]; return typeof v === 'number' ? (k.includes('R$') ? formatBRL(v) : formatNumber(v, 2)) : v ?? '—' },
    }))
  }, [q.data])
  const label = REPORTS.find((r) => r.id === rep)?.label ?? ''

  return (
    <>
      <PageHeader title="Relatórios" crumbs={[{ label: 'Gestão' }, { label: 'Relatórios' }]}
        description="Relatórios calculados a partir dos registros. Exporte em CSV, Excel ou PDF pelo botão Exportar da tabela."
        actions={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button>} />
      <div className="card no-print mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_160px_160px]">
        <FieldWrap label="Relatório" htmlFor="rep"><Select id="rep" value={rep} onChange={(e) => setRep(e.target.value as Report)}>{available.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></FieldWrap>
        <FieldWrap label="De" htmlFor="rf"><Input id="rf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></FieldWrap>
        <FieldWrap label="Até" htmlFor="rt"><Input id="rt" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></FieldWrap>
      </div>
      <h2 className="mb-2 hidden text-lg font-semibold print:block">{org.name} — {label} ({from} a {to}){farm ? ` — ${farm.name}` : ''}</h2>
      <DataTable rows={q.data} columns={columns} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} rowKey={(r) => JSON.stringify(r)} exportName={`${label} ${from} a ${to}`} pageSize={50} />
    </>
  )
}
