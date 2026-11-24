import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Map as MapIcon, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { KeyValue, PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Tabs } from '@/components/ui/primitives'
import { Dropdown, useConfirm } from '@/components/ui/overlay'
import { DataStateBadge, ErrorState, LoadingRows } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { FarmMap } from '@/components/maps/FarmMap'
import { formatArea, formatDateTime, formatNumber } from '@/lib/format'
import type { PolyGeom } from '@/utils/geo'
import { farmFields, fieldFormFields, IRRIGATION_LABEL, POI_LABEL, TENURE_LABEL } from './config'
import { useCurrentCrops, useFarm, useFarmFields, useFarmPois, type FieldRow, type PoiRow } from './useFarmData'

type Tab = 'geral' | 'talhoes' | 'pontos' | 'historico'

export function FarmDetailPage() {
  const { id = '' } = useParams()
  const { orgId, can, refresh } = useCurrentOrg()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('geral')
  const [editOpen, setEditOpen] = useState(false)
  const [fieldOpen, setFieldOpen] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()
  const farm = useFarm(id)
  const fields = useFarmFields(id)
  const pois = useFarmPois(id)
  const crops = useCurrentCrops(id)
  const history = useQuery({
    queryKey: ['geom-history', id],
    enabled: tab === 'historico',
    queryFn: () => unwrap(supabase.from('geometry_history').select('*').eq('farm_id', id).order('changed_at', { ascending: false }).limit(100)),
  })
  const seasons = useQuery({
    queryKey: ['seasons', 'farm', id],
    queryFn: () => unwrap(supabase.from('seasons').select('id, name, status, crops(name)').eq('farm_id', id).in('status', ['planejada', 'em_andamento']).is('archived_at', null)),
  })

  const inval = [['farm', id], ['farms'], ['farms-lite'], ['dashboard']]
  const update = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('farms').update(v as never).eq('id', id)), { invalidate: inval, onSuccess: () => refresh() })
  const archive = useAppMutation(async (archived: boolean) => unwrap(supabase.from('farms').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)),
    { invalidate: inval, success: (r) => (r ? 'Atualizado' : 'Atualizado'), onSuccess: () => refresh() })
  const remove = useAppMutation(async () => unwrap(supabase.from('farms').delete().eq('id', id)), { invalidate: inval, success: 'Propriedade excluída', onSuccess: () => { refresh(); navigate('/propriedades') } })
  const createField = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('fields').insert({ ...v, organization_id: orgId, farm_id: id } as never)), { invalidate: [['fields'], ['lk-fields'], ['dashboard']] })
  const removePoi = useAppMutation(async (pid: string) => unwrap(supabase.from('points_of_interest').delete().eq('id', pid)), { invalidate: [['pois', id]], success: 'Ponto removido' })

  if (farm.isLoading) return <LoadingRows rows={8} />
  if (farm.error || !farm.data) return <ErrorState error={farm.error ?? { code: 'PGRST116' }} onRetry={() => farm.refetch()} />
  const f = farm.data
  const mappedArea = (fields.data ?? []).reduce((s, x) => s + Number(x.area_ha ?? x.manual_area_ha ?? 0), 0)

  const fieldCols: Column<FieldRow>[] = [
    { key: 'name', header: 'Talhão', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}{r.code && <span className="ml-1 text-xs text-muted">({r.code})</span>}</span> },
    { key: 'area', header: 'Área', align: 'right', sortable: true, value: (r) => Number(r.area_ha ?? r.manual_area_ha ?? 0), cell: (r) => formatArea(r.area_ha ?? r.manual_area_ha) },
    { key: 'crop', header: 'Cultura atual', value: (r) => crops.data?.get(r.id)?.crop ?? '', cell: (r) => { const c = crops.data?.get(r.id); return c ? <span>{c.crop} <span className="text-xs text-muted">· {c.season}</span></span> : <span className="text-muted">Sem safra ativa</span> } },
    { key: 'soil', header: 'Solo', value: (r) => r.soil_type, cell: (r) => r.soil_type ?? '—' },
    { key: 'irr', header: 'Irrigação', value: (r) => IRRIGATION_LABEL[r.irrigation], cell: (r) => IRRIGATION_LABEL[r.irrigation] },
    { key: 'geom', header: 'Polígono', value: (r) => (r.geojson ? 'Sim' : 'Não'), cell: (r) => (r.geojson ? <Badge tone="green">Mapeado</Badge> : <Badge>Sem polígono</Badge>) },
  ]
  const poiCols: Column<PoiRow>[] = [
    { key: 'name', header: 'Nome', primary: true, value: (r) => r.name, cell: (r) => r.name },
    { key: 'kind', header: 'Tipo', value: (r) => POI_LABEL[r.kind], cell: (r) => POI_LABEL[r.kind] },
    { key: 'coord', header: 'Coordenadas', value: (r) => `${r.latitude}, ${r.longitude}`, cell: (r) => <span className="tabular text-xs">{Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}</span> },
    { key: 'act', header: '', align: 'right', cell: (r) => can('farms', 'edit') ? <Button variant="ghost" size="sm" onClick={async (e) => { e.stopPropagation(); if (await confirm('Remover ponto de interesse?', r.name, 'Remover')) removePoi.mutate(r.id) }}><Trash2 className="h-4 w-4" /></Button> : null },
  ]

  return (
    <>
      <PageHeader
        title={f.name}
        crumbs={[{ label: 'Minha fazenda' }, { label: 'Propriedades', to: '/propriedades' }, { label: f.name }]}
        badge={<>{f.is_demo && <DataStateBadge state="demo" />}{f.archived_at && <Badge tone="yellow">Arquivada</Badge>}</>}
        description={[f.city && `${f.city}/${f.state ?? ''}`, TENURE_LABEL[f.tenure_type ?? '']].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/mapa?fazenda=${id}`)}><MapIcon className="h-4 w-4" />Abrir mapa</Button>
            {can('farms', 'edit') && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />Editar</Button>}
            {(can('farms', 'edit') || can('farms', 'delete')) && (
              <Dropdown trigger={<Button variant="outline" size="icon" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button>}
                items={[
                  ...(can('farms', 'edit') ? [f.archived_at
                    ? { label: 'Restaurar', icon: <ArchiveRestore className="h-4 w-4" />, onSelect: () => archive.mutate(false) }
                    : { label: 'Arquivar', icon: <Archive className="h-4 w-4" />, onSelect: async () => { if (await confirm('Arquivar propriedade?', 'Ela deixa de aparecer nas listas, mas todo o histórico é preservado. Você pode restaurá-la depois.', 'Arquivar')) archive.mutate(true) } }] : []),
                  ...(can('farms', 'delete') ? [{ label: 'Excluir definitivamente', danger: true, icon: <Trash2 className="h-4 w-4" />, onSelect: async () => {
                    if (await confirm('Excluir propriedade?', 'Esta ação não pode ser desfeita e remove talhões e registros vinculados. Prefira arquivar para preservar o histórico.', 'Excluir')) remove.mutate()
                  } }] : []),
                ]} />
            )}
          </>
        }
      />

      <Tabs<Tab> value={tab} onChange={setTab} className="mb-5" items={[
        { value: 'geral', label: 'Visão geral' },
        { value: 'talhoes', label: 'Talhões', count: fields.data?.length },
        { value: 'pontos', label: 'Pontos de interesse', count: pois.data?.length },
        { value: 'historico', label: 'Histórico geométrico' },
      ]} />

      {tab === 'geral' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Área total" value={formatArea(f.total_area_ha ?? f.boundary_area_ha)} hint={f.boundary_area_ha ? `Polígono: ${formatArea(f.boundary_area_ha)}` : 'Limite não desenhado'} />
            <StatCard label="Área produtiva" value={formatArea(f.productive_area_ha)} />
            <StatCard label="Talhões" value={fields.data?.length ?? '—'} hint={`Área em talhões: ${formatArea(mappedArea)}`} />
            <StatCard label="Safras ativas" value={seasons.data?.length ?? '—'} hint={(seasons.data ?? []).map((s) => (s.crops as { name: string } | null)?.name).filter(Boolean).join(', ') || undefined} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <FarmMap boundary={f.boundary_geojson as PolyGeom | null}
              fields={(fields.data ?? []).map((x) => ({ id: x.id, name: x.name, geometry: x.geojson as PolyGeom | null, color: x.color ?? crops.data?.get(x.id)?.color, subtitle: formatArea(x.area_ha) }))}
              pois={(pois.data ?? []).map((p) => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }))}
              center={f.latitude && f.longitude ? [Number(f.latitude), Number(f.longitude)] : null}
              onFieldClick={(fid) => navigate(`/talhoes/${fid}`)} height={360} fitKey={id} />
            <Card>
              <CardHeader title="Dados cadastrais" />
              <div className="p-5">
                <KeyValue className="sm:grid-cols-2 lg:grid-cols-2" items={[
                  { label: 'Código', value: f.code }, { label: 'Município/UF', value: f.city ? `${f.city}/${f.state ?? ''}` : null },
                  { label: 'Endereço', value: f.address }, { label: 'Coordenadas', value: f.latitude ? `${formatNumber(f.latitude, 5)}, ${formatNumber(f.longitude, 5)}` : null },
                  { label: 'APP', value: formatArea(f.preservation_area_ha) }, { label: 'Reserva legal', value: formatArea(f.legal_reserve_ha) },
                  { label: 'Perímetro (polígono)', value: f.boundary_perimeter_m ? `${formatNumber(Number(f.boundary_perimeter_m) / 1000, 2)} km` : null },
                  { label: 'Responsável', value: f.owner_name }, { label: 'CAR', value: f.car_code }, { label: 'INCRA/CCIR', value: f.incra_code },
                ]} />
                {f.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{f.notes}</p>}
                <div className="mt-4 text-xs"><Link className="text-brand-700 underline" to={`/documentos?fazenda=${id}`}>Ver documentos da propriedade</Link></div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'talhoes' && (
        <DataTable rows={fields.data} columns={fieldCols} loading={fields.isLoading} error={fields.error} onRetry={() => fields.refetch()}
          onRowClick={(r) => navigate(`/talhoes/${r.id}`)} exportName={`Talhões ${f.name}`}
          toolbar={can('fields', 'create') ? <Button size="sm" onClick={() => setFieldOpen(true)}><Plus className="h-4 w-4" />Novo talhão</Button> : undefined} />
      )}
      {tab === 'pontos' && (
        <DataTable rows={pois.data} columns={poiCols} loading={pois.isLoading} error={pois.error} exportName="Pontos de interesse"
          toolbar={<Button size="sm" variant="outline" onClick={() => navigate(`/mapa?fazenda=${id}`)}>Adicionar no mapa</Button>} />
      )}
      {tab === 'historico' && (
        <Card>
          <CardHeader title="Histórico de alterações geométricas" description="Cada alteração de limite ou talhão é registrada com autor, data e área." />
          {history.isLoading ? <LoadingRows /> : (
            <ul className="divide-y divide-line">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>{h.entity_type === 'farm' ? 'Limite da propriedade' : `Talhão: ${fields.data?.find((x) => x.id === h.entity_id)?.name ?? 'removido/arquivado'}`}</span>
                  <span className="text-muted">{formatArea(h.area_ha)} · {formatDateTime(h.changed_at)}</span>
                </li>
              ))}
              {!history.data?.length && <li className="px-5 py-8 text-center text-sm text-muted">Nenhuma alteração registrada.</li>}
            </ul>
          )}
        </Card>
      )}

      <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} title="Editar propriedade" fields={farmFields} initial={f} onSubmit={(v) => update.mutateAsync(v)} />
      <ResourceFormDialog open={fieldOpen} onOpenChange={setFieldOpen} title="Novo talhão" fields={fieldFormFields} defaults={{ irrigation: 'sequeiro' }}
        description="Você pode desenhar o polígono depois, no mapa." onSubmit={(v) => createField.mutateAsync(v)} />
      {confirmNode}
    </>
  )
}
