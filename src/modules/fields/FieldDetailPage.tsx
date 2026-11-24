import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Map as MapIcon, Pencil } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { KeyValue, PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Tabs } from '@/components/ui/primitives'
import { useConfirm } from '@/components/ui/overlay'
import { DataStateBadge, ErrorState, LoadingRows } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { FarmMap } from '@/components/maps/FarmMap'
import { formatArea, formatBRL, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import type { PolyGeom } from '@/utils/geo'
import { fieldFormFields, IRRIGATION_LABEL } from '@/modules/farms/config'
import { SEASON_STATUS } from '@/modules/seasons/config'

type Tab = 'resumo' | 'safras' | 'atividades' | 'insumos' | 'colheitas'

export function FieldDetailPage() {
  const { id = '' } = useParams()
  const { can } = useCurrentOrg()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumo')
  const [edit, setEdit] = useState(false)
  const { confirm, node } = useConfirm()

  const field = useQuery({ queryKey: ['field', id], queryFn: () => unwrap(supabase.from('fields').select('*, farms(id, name, boundary_geojson)').eq('id', id).single()) })
  const seasons = useQuery({
    queryKey: ['field-seasons', id],
    queryFn: () => unwrap(supabase.from('season_fields').select('*, seasons(id, name, status, cycle, start_date, crops(name, sack_weight_kg)), varieties(name)').eq('field_id', id).order('created_at', { ascending: false })),
  })
  const activities = useQuery({
    queryKey: ['field-activities', id],
    queryFn: () => unwrap(supabase.from('activities').select('id, title, status, started_at, labor_cost, other_cost, inputs_cost, activity_types(name, color), seasons(name)').eq('field_id', id).order('started_at', { ascending: false }).limit(200)),
  })
  const inputs = useQuery({
    queryKey: ['field-inputs', id],
    enabled: tab === 'insumos',
    queryFn: () => unwrap(supabase.from('stock_movements').select('id, quantity, total_cost, occurred_at, inventory_items(name, unit), seasons(name)').eq('field_id', id).eq('kind', 'saida').order('occurred_at', { ascending: false })),
  })
  const harvests = useQuery({
    queryKey: ['field-harvests', id],
    queryFn: () => unwrap(supabase.from('harvest_records').select('*, seasons(name, crops(sack_weight_kg))').eq('field_id', id).order('harvest_date', { ascending: false })),
  })
  const update = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('fields').update(v as never).eq('id', id)), { invalidate: [['field', id], ['fields'], ['lk-fields']] })

  if (field.isLoading) return <LoadingRows rows={8} />
  if (field.error || !field.data) return <ErrorState error={field.error} onRetry={() => field.refetch()} />
  const f = field.data
  const farm = f.farms as { id: string; name: string; boundary_geojson: unknown } | null
  const area = Number(f.area_ha ?? f.manual_area_ha ?? 0)
  const totalCost = (activities.data ?? []).filter((a) => a.status !== 'cancelada').reduce((s, a) => s + Number(a.labor_cost) + Number(a.other_cost) + Number(a.inputs_cost), 0)
  const current = (seasons.data ?? []).find((s) => ['planejada', 'em_andamento'].includes((s.seasons as { status: string } | null)?.status ?? ''))
  const cs = current?.seasons as { id: string; name: string; crops: { name: string } | null } | undefined

  type SF = NonNullable<typeof seasons.data>[number]
  const seasonCols: Column<SF>[] = [
    { key: 'season', header: 'Safra', primary: true, value: (r) => (r.seasons as { name: string } | null)?.name, cell: (r) => <Link className="font-medium text-brand-800 hover:underline" to={`/safras/${r.season_id}`}>{(r.seasons as { name: string } | null)?.name}</Link> },
    { key: 'crop', header: 'Cultura', value: (r) => (r.seasons as { crops: { name: string } | null } | null)?.crops?.name, cell: (r) => (r.seasons as { crops: { name: string } | null } | null)?.crops?.name ?? '—' },
    { key: 'var', header: 'Variedade', value: (r) => (r.varieties as { name: string } | null)?.name, cell: (r) => (r.varieties as { name: string } | null)?.name ?? '—' },
    { key: 'plant', header: 'Plantio', value: (r) => r.planting_date, cell: (r) => formatDate(r.planting_date) },
    { key: 'harv', header: 'Colheita prevista', value: (r) => r.expected_harvest_date, cell: (r) => formatDate(r.expected_harvest_date) },
    { key: 'area', header: 'Área plantada', align: 'right', value: (r) => Number(r.planted_area_ha), cell: (r) => formatArea(r.planted_area_ha) },
    { key: 'status', header: 'Status', value: (r) => (r.seasons as { status: string } | null)?.status, cell: (r) => { const st = SEASON_STATUS[(r.seasons as { status: string } | null)?.status ?? '']; return st ? <Badge tone={st.tone}>{st.label}</Badge> : '—' } },
  ]
  type A = NonNullable<typeof activities.data>[number]
  const actCols: Column<A>[] = [
    { key: 'date', header: 'Data', sortable: true, value: (r) => r.started_at, cell: (r) => formatDateTime(r.started_at) },
    { key: 'type', header: 'Tipo', primary: true, value: (r) => (r.activity_types as { name: string } | null)?.name, cell: (r) => <span className="font-medium">{(r.activity_types as { name: string } | null)?.name}{r.title && <span className="font-normal text-muted"> — {r.title}</span>}</span> },
    { key: 'season', header: 'Safra', value: (r) => (r.seasons as { name: string } | null)?.name, cell: (r) => (r.seasons as { name: string } | null)?.name ?? '—' },
    { key: 'cost', header: 'Custo', align: 'right', value: (r) => Number(r.labor_cost) + Number(r.other_cost) + Number(r.inputs_cost), cell: (r) => formatBRL(Number(r.labor_cost) + Number(r.other_cost) + Number(r.inputs_cost)) },
  ]
  type I = NonNullable<typeof inputs.data>[number]
  const inputCols: Column<I>[] = [
    { key: 'date', header: 'Data', value: (r) => r.occurred_at, cell: (r) => formatDate(r.occurred_at) },
    { key: 'item', header: 'Insumo', primary: true, value: (r) => (r.inventory_items as { name: string } | null)?.name, cell: (r) => (r.inventory_items as { name: string } | null)?.name },
    { key: 'qty', header: 'Quantidade', align: 'right', value: (r) => Number(r.quantity), cell: (r) => `${formatNumber(r.quantity)} ${(r.inventory_items as { unit: string } | null)?.unit ?? ''}` },
    { key: 'dose', header: 'Dose/ha', align: 'right', value: (r) => (area ? Number(r.quantity) / area : null), cell: (r) => (area ? `${formatNumber(Number(r.quantity) / area, 2)}` : '—') },
    { key: 'cost', header: 'Custo', align: 'right', value: (r) => Number(r.total_cost), cell: (r) => formatBRL(r.total_cost) },
    { key: 'season', header: 'Safra', value: (r) => (r.seasons as { name: string } | null)?.name, cell: (r) => (r.seasons as { name: string } | null)?.name ?? '—' },
  ]
  type H = NonNullable<typeof harvests.data>[number]
  const harvestCols: Column<H>[] = [
    { key: 'date', header: 'Data', value: (r) => r.harvest_date, cell: (r) => formatDate(r.harvest_date) },
    { key: 'season', header: 'Safra', primary: true, value: (r) => (r.seasons as { name: string } | null)?.name, cell: (r) => (r.seasons as { name: string } | null)?.name },
    { key: 'qty', header: 'Quantidade', align: 'right', value: (r) => Number(r.quantity), cell: (r) => `${formatNumber(r.quantity)} ${r.unit}` },
    { key: 'kg', header: 'Peso', align: 'right', value: (r) => Number(r.quantity_kg), cell: (r) => (r.quantity_kg ? `${formatNumber(Number(r.quantity_kg) / 1000, 2)} t` : '—') },
    { key: 'yield', header: 'Produtividade', align: 'right', value: (r) => r.quantity_kg, cell: (r) => { const sk = (r.seasons as { crops: { sack_weight_kg: number | null } | null } | null)?.crops?.sack_weight_kg; return sk && area && r.quantity_kg ? `${formatNumber(Number(r.quantity_kg) / Number(sk) / area, 1)} sc/ha` : '—' } },
    { key: 'moist', header: 'Umidade', align: 'right', value: (r) => r.moisture_pct, cell: (r) => (r.moisture_pct ? `${formatNumber(r.moisture_pct, 1)}%` : '—') },
  ]

  return (
    <>
      <PageHeader title={f.name} badge={<>{f.is_demo && <DataStateBadge state="demo" />}{f.archived_at && <Badge tone="yellow">Arquivado</Badge>}</>}
        crumbs={[{ label: 'Minha fazenda' }, { label: 'Talhões', to: '/talhoes' }, { label: f.name }]}
        description={<>{farm && <Link className="underline" to={`/propriedades/${farm.id}`}>{farm.name}</Link>} · {formatArea(area)}{f.code && ` · Código ${f.code}`}</>}
        actions={<>
          <Button variant="outline" onClick={() => navigate(`/mapa?fazenda=${f.farm_id}`)}><MapIcon className="h-4 w-4" />Mapa</Button>
          {can('fields', 'edit') && <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Editar</Button>}
          {can('fields', 'edit') && (f.archived_at
            ? <Button variant="outline" onClick={() => update.mutate({ archived_at: null })}><ArchiveRestore className="h-4 w-4" />Restaurar</Button>
            : <Button variant="outline" onClick={async () => { if (await confirm('Arquivar talhão?', 'O histórico de safras, atividades e colheitas é mantido.', 'Arquivar')) update.mutate({ archived_at: new Date().toISOString() }) }}><Archive className="h-4 w-4" />Arquivar</Button>)}
        </>} />
      <Tabs value={tab} onChange={setTab} className="mb-5" items={[
        { value: 'resumo', label: 'Resumo' }, { value: 'safras', label: 'Safras', count: seasons.data?.length },
        { value: 'atividades', label: 'Atividades', count: activities.data?.length }, { value: 'insumos', label: 'Insumos' },
        { value: 'colheitas', label: 'Colheitas', count: harvests.data?.length },
      ]} />
      {tab === 'resumo' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Área" value={formatArea(area)} hint={f.geojson ? `Perímetro ${formatNumber(Number(f.perimeter_m) / 1000, 2)} km` : 'Área informada (sem polígono)'} />
            <StatCard label="Cultura atual" value={cs?.crops?.name ?? '—'} hint={cs ? <Link className="underline" to={`/safras/${cs.id}`}>{cs.name}</Link> : 'Sem safra ativa'} />
            <StatCard label="Custo operacional acumulado" value={formatBRL(totalCost)} hint={area ? `${formatBRL(totalCost / area)}/ha` : undefined} />
            <StatCard label="Atividades registradas" value={activities.data?.length ?? '—'} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <FarmMap boundary={farm?.boundary_geojson as PolyGeom | null} fields={[{ id: f.id, name: f.name, geometry: f.geojson as PolyGeom | null, color: f.color }]} selectedId={f.id} height={340} fitKey={f.id} />
            <Card>
              <CardHeader title="Ficha do talhão" />
              <div className="p-5">
                <KeyValue className="sm:grid-cols-2 lg:grid-cols-2" items={[
                  { label: 'Solo', value: f.soil_type }, { label: 'Relevo', value: f.relief?.replace('_', ' ') },
                  { label: 'Irrigação', value: IRRIGATION_LABEL[f.irrigation] }, { label: 'Estágio atual', value: current?.stage },
                  { label: 'Variedade atual', value: (current?.varieties as { name: string } | null)?.name },
                  { label: 'Plantio', value: formatDate(current?.planting_date) },
                ]} />
                {f.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{f.notes}</p>}
                <div className="mt-4 flex gap-3 text-xs">
                  <Link className="text-brand-700 underline" to={`/diario?talhao=${f.id}`}>Registrar atividade</Link>
                  <Link className="text-brand-700 underline" to={`/documentos?talhao=${f.id}`}>Documentos e análises</Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === 'safras' && <DataTable rows={seasons.data} columns={seasonCols} loading={seasons.isLoading} error={seasons.error} exportName={`Safras ${f.name}`} />}
      {tab === 'atividades' && <DataTable rows={activities.data} columns={actCols} loading={activities.isLoading} error={activities.error} exportName={`Atividades ${f.name}`} initialSort={{ key: 'date', dir: 'desc' }} />}
      {tab === 'insumos' && <DataTable rows={inputs.data} columns={inputCols} loading={inputs.isLoading} error={inputs.error} exportName={`Insumos ${f.name}`} />}
      {tab === 'colheitas' && <DataTable rows={harvests.data} columns={harvestCols} loading={harvests.isLoading} error={harvests.error} exportName={`Colheitas ${f.name}`} />}
      <ResourceFormDialog open={edit} onOpenChange={setEdit} title="Editar talhão" fields={fieldFormFields} initial={f} onSubmit={(v) => update.mutateAsync(v)} />
      {node}
    </>
  )
}
