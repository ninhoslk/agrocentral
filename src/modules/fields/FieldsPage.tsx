import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Grid3x3, Plus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, FieldWrap, Select, Tabs } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { formatArea, formatBRL, formatNumber } from '@/lib/format'
import { fieldFormFields, IRRIGATION_LABEL } from '@/modules/farms/config'
import { useLookups } from '@/hooks/useLookups'
import { fieldIndicators, type FieldIndicator } from './indicators'
import type { Tables } from '@/types/database'

type Row = Tables<'fields'> & { farms: { name: string } | null }

export function FieldsPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'lista' | 'comparativo'>('lista')
  const [open, setOpen] = useState(false)

  const q = useQuery({
    queryKey: ['fields', orgId, farmId],
    queryFn: () => {
      let qb = supabase.from('fields').select('*, farms(name)').eq('organization_id', orgId).is('archived_at', null).order('name')
      if (farmId) qb = qb.eq('farm_id', farmId)
      return unwrap(qb) as Promise<Row[]>
    },
  })
  const crops = useQuery({
    queryKey: ['current-crops-org', orgId],
    queryFn: () => unwrap(supabase.from('season_fields').select('field_id, seasons!inner(name, status, crops(name))').eq('organization_id', orgId).in('seasons.status', ['planejada', 'em_andamento'])),
  })
  const cropMap = useMemo(() => new Map((crops.data ?? []).map((r) => {
    const s = r.seasons as unknown as { name: string; crops: { name: string } | null }
    return [r.field_id, `${s.crops?.name ?? ''} · ${s.name}`]
  })), [crops.data])

  const create = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('fields').insert({ ...v, organization_id: orgId } as never)),
    { invalidate: [['fields'], ['lk-fields'], ['dashboard']] })

  const formFields: FieldDef[] = [
    { name: 'farm_id', label: 'Propriedade', type: 'select', required: true, options: farms.map((f) => ({ value: f.id, label: f.name })), span: 3 },
    ...fieldFormFields,
  ]

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Talhão', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color ?? '#22c55e' }} />{r.name}{r.code && <span className="text-xs text-muted">{r.code}</span>}<DemoBadge show={r.is_demo} /></span> },
    { key: 'farm', header: 'Propriedade', sortable: true, value: (r) => r.farms?.name, cell: (r) => r.farms?.name ?? '—' },
    { key: 'area', header: 'Área', align: 'right', sortable: true, value: (r) => Number(r.area_ha ?? r.manual_area_ha ?? 0), cell: (r) => formatArea(r.area_ha ?? r.manual_area_ha) },
    { key: 'crop', header: 'Cultura / safra atual', value: (r) => cropMap.get(r.id) ?? '', cell: (r) => cropMap.get(r.id) ?? <span className="text-muted">—</span> },
    { key: 'soil', header: 'Solo', value: (r) => r.soil_type, cell: (r) => r.soil_type ?? '—' },
    { key: 'irr', header: 'Irrigação', value: (r) => IRRIGATION_LABEL[r.irrigation], cell: (r) => IRRIGATION_LABEL[r.irrigation] },
    { key: 'geom', header: 'Polígono', value: (r) => (r.geojson ? 'Sim' : 'Não'), cell: (r) => (r.geojson ? <Badge tone="green">Mapeado</Badge> : <Badge>Não</Badge>) },
  ]

  return (
    <>
      <PageHeader title="Talhões" crumbs={[{ label: 'Minha fazenda' }, { label: 'Talhões' }]}
        description="Unidades de manejo de cada propriedade. O histórico é preservado quando o talhão é reutilizado em novas safras."
        actions={can('fields', 'create') && farms.length > 0 ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Novo talhão</Button> : undefined} />
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'lista', label: 'Lista' }, { value: 'comparativo', label: 'Comparativo entre talhões' }]} />
      {tab === 'lista' ? (
        <DataTable rows={q.data} columns={cols} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} onRowClick={(r) => navigate(`/talhoes/${r.id}`)}
          exportName="Talhões" initialSort={{ key: 'name', dir: 'asc' }}
          empty={<EmptyState icon={<Grid3x3 className="h-6 w-6" />} title="Nenhum talhão" description={farms.length ? 'Cadastre talhões ou desenhe-os no mapa da fazenda.' : 'Cadastre primeiro uma propriedade.'}
            action={farms.length ? <Button onClick={() => navigate('/mapa')}>Abrir mapa</Button> : <Button onClick={() => navigate('/propriedades')}>Cadastrar propriedade</Button>} />} />
      ) : (
        <FieldComparison fields={q.data ?? []} />
      )}
      <ResourceFormDialog open={open} onOpenChange={setOpen} title="Novo talhão" fields={formFields} defaults={{ irrigation: 'sequeiro', farm_id: farmId ?? farms[0]?.id }}
        description="Para desenhar o polígono, use o Mapa da fazenda." onSubmit={(v) => create.mutateAsync(v)} />
    </>
  )
}

function FieldComparison({ fields }: { fields: Row[] }) {
  const { orgId } = useCurrentOrg()
  const { seasons, crops } = useLookups()
  const [seasonId, setSeasonId] = useState('')
  const season = seasons.data?.find((s) => s.id === seasonId)
  const sackKg = season ? crops.data?.find((c) => c.id === season.crop_id)?.sack_weight_kg ?? null : 60
  const data = useQuery({
    queryKey: ['field-compare', orgId, seasonId],
    queryFn: async () => {
      const ids = fields.map((f) => f.id)
      if (!ids.length) return { acts: [], txs: [], harvests: [] }
      const [acts, txs, harvests] = await Promise.all([
        unwrap(supabase.from('activities').select('field_id, season_id, labor_cost, other_cost, inputs_cost').in('field_id', ids).neq('status', 'cancelada')),
        unwrap(supabase.from('transactions').select('field_id, season_id, kind, amount, status').in('field_id', ids)).catch(() => []),
        unwrap(supabase.from('harvest_records').select('field_id, season_id, quantity_kg').in('field_id', ids)),
      ])
      return { acts, txs, harvests }
    },
    enabled: fields.length > 0,
  })
  const rows: FieldIndicator[] = useMemo(() => {
    if (!data.data) return []
    let fs = fields
    if (seasonId) {
      const inSeason = new Set(data.data.harvests.filter((h) => h.season_id === seasonId).map((h) => h.field_id))
      data.data.acts.filter((a) => a.season_id === seasonId).forEach((a) => a.field_id && inSeason.add(a.field_id))
      fs = fields.filter((f) => inSeason.has(f.id))
    }
    return fieldIndicators(fs.map((f) => ({ id: f.id, name: f.name, area: Number(f.area_ha ?? f.manual_area_ha ?? 0) })), data.data.acts, data.data.txs, data.data.harvests, sackKg ? Number(sackKg) : null, seasonId || null)
  }, [data.data, fields, seasonId, sackKg])

  const cols: Column<FieldIndicator>[] = [
    { key: 'name', header: 'Talhão', primary: true, value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'area', header: 'Área', align: 'right', sortable: true, value: (r) => r.areaHa, cell: (r) => formatArea(r.areaHa) },
    { key: 'cost', header: 'Custo total', align: 'right', sortable: true, value: (r) => r.totalCost, cell: (r) => formatBRL(r.totalCost) },
    { key: 'costha', header: 'Custo/ha', align: 'right', sortable: true, value: (r) => r.costPerHa, cell: (r) => formatBRL(r.costPerHa) },
    { key: 'prod', header: 'Produção', align: 'right', sortable: true, value: (r) => r.productionKg, cell: (r) => r.productionKg ? `${formatNumber(r.productionKg / 1000, 1)} t` : '—' },
    { key: 'yield', header: 'Produtividade', align: 'right', sortable: true, value: (r) => r.yieldScHa, cell: (r) => (r.yieldScHa ? `${formatNumber(r.yieldScHa, 1)} sc/ha` : '—') },
    { key: 'rev', header: 'Receita vinculada', align: 'right', value: (r) => r.revenue, cell: (r) => formatBRL(r.revenue) },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FieldWrap label="Safra" htmlFor="cmp-season" className="w-72">
          <Select id="cmp-season" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="">Todas as safras (acumulado)</option>
            {seasons.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FieldWrap>
        <p className="pb-2 text-xs text-muted">Custo = atividades (mão de obra, insumos consumidos, outros) + despesas lançadas no talhão. Produtividade em sacas usa o peso da saca da cultura{!seasonId && ' (60 kg no acumulado)'}.</p>
      </div>
      <Card>
        <CardHeader title="Custo por hectare (R$/ha)" />
        <div className="h-64 p-4">
          <ResponsiveContainer>
            <BarChart data={rows.filter((r) => r.costPerHa)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${formatNumber(v, 0)}`} width={80} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Bar dataKey="costPerHa" name="Custo/ha" fill="#2a6840" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <DataTable rows={rows} columns={cols} loading={data.isLoading} error={data.error} rowKey={(r) => r.fieldId} exportName="Comparativo de talhões" />
    </div>
  )
}
