import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Sprout } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Tabs } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { formatArea, formatBRL, formatDate, formatNumber } from '@/lib/format'
import { useLookups } from '@/hooks/useLookups'
import { SEASON_STATUS } from './config'

export interface SeasonSummary {
  id: string; name: string; cycle: string | null; status: string; start_date: string; end_date: string | null; is_demo: boolean
  farm_id: string; crop_id: string; expected_yield_per_ha: number | null; estimated_cost: number | null
  farms: { name: string } | null; crops: { name: string; sack_weight_kg: number | null } | null
  season_fields: { planted_area_ha: number | null; field_id: string }[]
}

export const seasonFormFields = (farms: { id: string; name: string }[], crops: { id: string; name: string }[], employees: { id: string; full_name: string }[]): FieldDef[] => [
  { name: 'name', label: 'Nome da safra', type: 'text', required: true, maxLength: 120, span: 2, placeholder: 'Ex.: Soja 2026/27' },
  { name: 'cycle', label: 'Ano/ciclo', type: 'text', maxLength: 20, span: 1, placeholder: '2026/27' },
  { name: 'farm_id', label: 'Propriedade', type: 'select', required: true, options: farms.map((f) => ({ value: f.id, label: f.name })), span: 2 },
  { name: 'crop_id', label: 'Cultura', type: 'select', required: true, options: crops.map((c) => ({ value: c.id, label: c.name })), span: 1 },
  { name: 'start_date', label: 'Início', type: 'date', required: true, span: 1 },
  { name: 'end_date', label: 'Fim previsto', type: 'date', span: 1 },
  { name: 'status', label: 'Status', type: 'select', required: true, options: Object.entries(SEASON_STATUS).map(([value, s]) => ({ value, label: s.label })), span: 1 },
  { name: 'expected_yield_per_ha', label: 'Produtividade esperada', type: 'number', min: 0, suffix: 'un/ha', span: 1, hint: 'Na unidade da cultura (ex.: sc/ha)' },
  { name: 'estimated_cost', label: 'Custo estimado', type: 'money', min: 0, span: 1 },
  { name: 'responsible_employee_id', label: 'Responsável', type: 'select', options: employees.map((e) => ({ value: e.id, label: e.full_name })), span: 1 },
  { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 2000, span: 3 },
]

export function SeasonsPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const navigate = useNavigate()
  const { crops, employees } = useLookups()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'ativas' | 'todas' | 'comparativo'>('ativas')

  const q = useQuery({
    queryKey: ['seasons', orgId, farmId],
    queryFn: () => {
      let qb = supabase.from('seasons').select('*, farms(name), crops(name, sack_weight_kg), season_fields(planted_area_ha, field_id)').eq('organization_id', orgId).is('archived_at', null).order('start_date', { ascending: false })
      if (farmId) qb = qb.eq('farm_id', farmId)
      return unwrap(qb) as unknown as Promise<SeasonSummary[]>
    },
  })
  const create = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('seasons').insert({ ...v, organization_id: orgId } as never).select('id').single()),
    { invalidate: [['seasons'], ['lk-seasons'], ['dashboard']], onSuccess: (r) => navigate(`/safras/${(r as { id: string }).id}`) })

  const rows = useMemo(() => (q.data ?? []).filter((s) => tab !== 'ativas' || ['planejada', 'em_andamento'].includes(s.status)), [q.data, tab])
  const cols: Column<SeasonSummary>[] = [
    { key: 'name', header: 'Safra', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.name}<DemoBadge show={r.is_demo} /></span> },
    { key: 'crop', header: 'Cultura', sortable: true, value: (r) => r.crops?.name, cell: (r) => r.crops?.name },
    { key: 'farm', header: 'Propriedade', value: (r) => r.farms?.name, cell: (r) => r.farms?.name },
    { key: 'fields', header: 'Talhões', align: 'right', value: (r) => r.season_fields.length, cell: (r) => r.season_fields.length },
    { key: 'area', header: 'Área', align: 'right', sortable: true, value: (r) => r.season_fields.reduce((s, x) => s + Number(x.planted_area_ha ?? 0), 0), cell: (r) => formatArea(r.season_fields.reduce((s, x) => s + Number(x.planted_area_ha ?? 0), 0)) },
    { key: 'period', header: 'Período', sortable: true, value: (r) => r.start_date, cell: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}` },
    { key: 'status', header: 'Status', value: (r) => SEASON_STATUS[r.status]?.label, cell: (r) => <Badge tone={SEASON_STATUS[r.status]?.tone}>{SEASON_STATUS[r.status]?.label}</Badge> },
  ]

  return (
    <>
      <PageHeader title="Safras e culturas" crumbs={[{ label: 'Minha fazenda' }, { label: 'Safras' }]}
        description="Planeje safras, vincule talhões, acompanhe desenvolvimento, colheita e resultados."
        actions={can('seasons', 'create') && farms.length > 0 ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova safra</Button> : undefined} />
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'ativas', label: 'Ativas' }, { value: 'todas', label: 'Todas' }, { value: 'comparativo', label: 'Comparativo' }]} />
      {tab === 'comparativo' ? <SeasonComparison seasons={q.data ?? []} /> : (
        <DataTable rows={rows} columns={cols} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} onRowClick={(r) => navigate(`/safras/${r.id}`)} exportName="Safras"
          empty={<EmptyState icon={<Sprout className="h-6 w-6" />} title="Nenhuma safra" description="Crie uma safra e vincule os talhões para acompanhar o ciclo produtivo."
            action={can('seasons', 'create') && farms.length ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova safra</Button> : undefined} />} />
      )}
      <ResourceFormDialog open={open} onOpenChange={setOpen} title="Nova safra"
        fields={seasonFormFields(farms, crops.data ?? [], employees.data ?? [])}
        defaults={{ status: 'planejada', farm_id: farmId ?? farms[0]?.id, start_date: new Date().toISOString().slice(0, 10) }}
        onSubmit={(v) => create.mutateAsync(v)}
        refine={(v) => (v.end_date && v.start_date && v.end_date < v.start_date ? 'O fim não pode ser anterior ao início' : null)} />
    </>
  )
}

function SeasonComparison({ seasons }: { seasons: SeasonSummary[] }) {
  const { orgId } = useCurrentOrg()
  const ids = seasons.map((s) => s.id)
  const data = useQuery({
    queryKey: ['season-compare', orgId, ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [acts, txs, harvests] = await Promise.all([
        unwrap(supabase.from('activities').select('season_id, labor_cost, other_cost, inputs_cost').in('season_id', ids).neq('status', 'cancelada')),
        unwrap(supabase.from('transactions').select('season_id, kind, amount, status').in('season_id', ids)).catch(() => [] as { season_id: string | null; kind: string; amount: number; status: string }[]),
        unwrap(supabase.from('harvest_records').select('season_id, quantity_kg').in('season_id', ids)),
      ])
      return seasons.map((s) => {
        const area = s.season_fields.reduce((a, x) => a + Number(x.planted_area_ha ?? 0), 0)
        const opCost = acts.filter((a) => a.season_id === s.id).reduce((a, x) => a + Number(x.labor_cost) + Number(x.other_cost) + Number(x.inputs_cost), 0)
        const exp = txs.filter((t) => t.season_id === s.id && t.kind === 'despesa' && t.status !== 'cancelado').reduce((a, x) => a + Number(x.amount), 0)
        const rev = txs.filter((t) => t.season_id === s.id && t.kind === 'receita' && t.status !== 'cancelado').reduce((a, x) => a + Number(x.amount), 0)
        const kg = harvests.filter((h) => h.season_id === s.id).reduce((a, x) => a + Number(x.quantity_kg ?? 0), 0)
        const sk = s.crops?.sack_weight_kg ? Number(s.crops.sack_weight_kg) : null
        const sacks = sk ? kg / sk : null
        const cost = opCost + exp
        return { id: s.id, name: s.name, crop: s.crops?.name ?? '', area, cost, revenue: rev, margin: rev - cost, costHa: area ? cost / area : null, yieldHa: sacks && area ? sacks / area : null, costSack: sacks ? cost / sacks : null }
      })
    },
  })
  type R = NonNullable<typeof data.data>[number]
  const cols: Column<R>[] = [
    { key: 'name', header: 'Safra', primary: true, value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'crop', header: 'Cultura', value: (r) => r.crop, cell: (r) => r.crop },
    { key: 'area', header: 'Área', align: 'right', value: (r) => r.area, cell: (r) => formatArea(r.area) },
    { key: 'cost', header: 'Custo', align: 'right', sortable: true, value: (r) => r.cost, cell: (r) => formatBRL(r.cost) },
    { key: 'costha', header: 'Custo/ha', align: 'right', sortable: true, value: (r) => r.costHa, cell: (r) => formatBRL(r.costHa) },
    { key: 'yield', header: 'Produtividade', align: 'right', sortable: true, value: (r) => r.yieldHa, cell: (r) => (r.yieldHa ? `${formatNumber(r.yieldHa, 1)} sc/ha` : '—') },
    { key: 'costsack', header: 'Custo/saca', align: 'right', value: (r) => r.costSack, cell: (r) => formatBRL(r.costSack) },
    { key: 'rev', header: 'Receita', align: 'right', value: (r) => r.revenue, cell: (r) => formatBRL(r.revenue) },
    { key: 'margin', header: 'Margem', align: 'right', sortable: true, value: (r) => r.margin, cell: (r) => <span className={r.margin < 0 ? 'text-danger' : 'text-ok'}>{formatBRL(r.margin)}</span> },
  ]
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Custo × receita por safra" description="Custos de atividades e despesas vinculadas; receitas lançadas na safra." />
        <div className="h-72 p-4">
          <ResponsiveContainer>
            <BarChart data={data.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${formatNumber(v / 1000, 0)} mil`} width={70} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Legend />
              <Bar dataKey="cost" name="Custo" fill="#b42318" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" name="Receita" fill="#2a6840" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <DataTable rows={data.data} columns={cols} loading={data.isLoading} error={data.error} exportName="Comparativo de safras" />
    </div>
  )
}
