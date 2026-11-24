import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, FileUp, MapPin, MoreHorizontal, Pencil, Plus, Shapes, X } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { Dialog, Dropdown } from '@/components/ui/overlay'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { DataStateBadge, EmptyState } from '@/components/feedback/states'
import { FarmMap } from '@/components/maps/FarmMap'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { formatArea, formatNumber } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'
import { areaHa, downloadText, parseGeoFile, perimeterM, toKML, validatePolygon, type PolyGeom } from '@/utils/geo'
import { fieldFormFields, POI_KINDS } from './config'
import { useCurrentCrops, useFarm, useFarmFields, useFarmPois } from './useFarmData'

type Mode =
  | { kind: 'idle' }
  | { kind: 'draw-boundary' }
  | { kind: 'draw-field' }
  | { kind: 'edit-boundary' }
  | { kind: 'edit-field'; fieldId: string }
  | { kind: 'draw-existing'; fieldId: string }
  | { kind: 'add-poi' }

export function FarmMapPage() {
  const { orgId, farmId, farms, setFarmId, can } = useCurrentOrg()
  const desktop = useIsDesktop()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const activeFarmId = params.get('fazenda') ?? farmId ?? (farms.length === 1 ? farms[0].id : null)
  const farm = useFarm(activeFarmId)
  const fields = useFarmFields(activeFarmId)
  const pois = useFarmPois(activeFarmId)
  const crops = useCurrentCrops(activeFarmId)
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [draft, setDraft] = useState<PolyGeom | null>(null)
  const [seed, setSeed] = useState<PolyGeom | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [newFieldOpen, setNewFieldOpen] = useState(false)
  const [poiDraft, setPoiDraft] = useState<{ lat: number; lon: number } | null>(null)
  const [importItems, setImportItems] = useState<{ geometry: PolyGeom; name?: string; area: number; include: boolean; newName: string }[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canEditFarm = can('farms', 'edit')
  const canCreateField = can('fields', 'create')
  const canEditField = can('fields', 'edit')

  const inval = [['farm', activeFarmId], ['fields'], ['farms'], ['dashboard'], ['lk-fields']]
  const saveBoundary = useAppMutation(
    async (g: PolyGeom | null) => unwrap(supabase.from('farms').update({ boundary_geojson: g as never }).eq('id', activeFarmId!)),
    { invalidate: inval, success: 'Limite da propriedade salvo' },
  )
  const saveFieldGeom = useAppMutation(
    async ({ id, g }: { id: string; g: PolyGeom }) => unwrap(supabase.from('fields').update({ geojson: g as never }).eq('id', id)),
    { invalidate: inval, success: 'Geometria do talhão atualizada' },
  )
  const createField = useAppMutation(
    async (v: Record<string, unknown>) => unwrap(supabase.from('fields').insert({ ...v, organization_id: orgId, farm_id: activeFarmId } as never)),
    { invalidate: inval },
  )
  const createPoi = useAppMutation(
    async (v: { kind: string; name: string; lat: number; lon: number }) =>
      unwrap(supabase.from('points_of_interest').insert({ organization_id: orgId, farm_id: activeFarmId!, kind: v.kind, name: v.name, latitude: v.lat, longitude: v.lon })),
    { invalidate: [['pois', activeFarmId]], success: 'Ponto de interesse adicionado' },
  )

  const mapFields = useMemo(() => (fields.data ?? []).map((f) => {
    const c = crops.data?.get(f.id)
    return {
      id: f.id, name: f.name, geometry: f.geojson as unknown as PolyGeom | null,
      color: f.color ?? c?.color ?? '#22c55e',
      subtitle: `${formatArea(f.area_ha ?? f.manual_area_ha)}${c ? ` · ${c.crop} (${c.season})` : ''}`,
    }
  }).filter((f) => !(mode.kind === 'edit-field' && mode.fieldId === f.id)), [fields.data, crops.data, mode])

  if (!activeFarmId) {
    return (
      <>
        <PageHeader title="Mapa da fazenda" crumbs={[{ label: 'Minha fazenda' }, { label: 'Mapa' }]} />
        {farms.length ? (
          <div className="card max-w-md space-y-3 p-5">
            <p className="text-sm">Escolha a propriedade para abrir o mapa:</p>
            <Select onChange={(e) => e.target.value && setFarmId(e.target.value)} defaultValue="">
              <option value="">Selecione…</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
        ) : (
          <EmptyState title="Nenhuma propriedade" description="Cadastre uma propriedade para usar o mapa." action={<Button onClick={() => navigate('/propriedades')}>Ir para propriedades</Button>} />
        )}
      </>
    )
  }

  const f = farm.data
  const boundary = (f?.boundary_geojson ?? null) as PolyGeom | null
  const editing = mode.kind === 'edit-boundary' ? boundary : mode.kind === 'edit-field' ? ((fields.data?.find((x) => x.id === mode.fieldId)?.geojson ?? null) as PolyGeom | null) : seed
  const isDraw = mode.kind === 'draw-boundary' || mode.kind === 'draw-field' || mode.kind === 'draw-existing'
  const drawing = isDraw && !seed
  const busy = saveBoundary.isPending || saveFieldGeom.isPending || createField.isPending

  const reset = () => { setMode({ kind: 'idle' }); setDraft(null); setSeed(null) }

  const confirmGeometry = async () => {
    const g = draft
    if (!g) { toast.error('Desenhe ou ajuste o polígono antes de salvar'); return }
    const err = validatePolygon(g)
    if (err) { toast.error(err); return }
    if (mode.kind === 'draw-boundary' || mode.kind === 'edit-boundary') { await saveBoundary.mutateAsync(g); reset() }
    else if (mode.kind === 'edit-field' || mode.kind === 'draw-existing') { await saveFieldGeom.mutateAsync({ id: mode.fieldId, g }); reset() }
    else if (mode.kind === 'draw-field') setNewFieldOpen(true)
  }

  const onImport = async (file: File) => {
    try {
      const polys = await parseGeoFile(file)
      if (!polys.length) { toast.error('Nenhum polígono encontrado no arquivo'); return }
      for (const p of polys) { const e = validatePolygon(p.geometry); if (e) { toast.error(e); return } }
      setImportItems(polys.map((p, i) => ({ ...p, area: areaHa(p.geometry), include: true, newName: p.name ?? `Talhão importado ${i + 1}` })))
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportAll = (format: 'kml' | 'geojson') => {
    const items = [
      ...(boundary ? [{ name: `${f?.name} (limite)`, geometry: boundary }] : []),
      ...(fields.data ?? []).filter((x) => x.geojson).map((x) => ({ name: x.name, geometry: x.geojson as unknown as PolyGeom, description: `Área: ${formatArea(x.area_ha)}` })),
    ]
    if (!items.length) { toast.error('Não há geometrias para exportar'); return }
    const base = (f?.name ?? 'fazenda').replace(/[^\w-]+/g, '_')
    if (format === 'kml') downloadText(toKML(items, f?.name), `${base}.kml`, 'application/vnd.google-earth.kml+xml')
    else downloadText(JSON.stringify({ type: 'FeatureCollection', features: items.map((i) => ({ type: 'Feature', properties: { name: i.name }, geometry: i.geometry })) }, null, 2), `${base}.geojson`, 'application/geo+json')
  }

  return (
    <>
      <PageHeader
        title="Mapa da fazenda"
        crumbs={[{ label: 'Minha fazenda' }, { label: 'Propriedades', to: '/propriedades' }, { label: f?.name ?? '…', to: `/propriedades/${activeFarmId}` }, { label: 'Mapa' }]}
        badge={f?.is_demo ? <DataStateBadge state="demo" /> : undefined}
        description={f?.is_demo ? 'Geometrias ilustrativas — não representam limites georreferenciados confirmados.' : 'Desenhe limites e talhões, importe arquivos KML/KMZ/GeoJSON e marque pontos de interesse. Área e perímetro são calculados automaticamente.'}
        actions={desktop ? (
          <>
            {farms.length > 1 && (
              <Select aria-label="Propriedade" value={activeFarmId} onChange={(e) => { setFarmId(e.target.value); navigate('/mapa') }} className="h-9 w-56">
                {farms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => exportAll('kml')}><Download className="h-4 w-4" />KML</Button>
            <Button variant="outline" size="sm" onClick={() => exportAll('geojson')}><Download className="h-4 w-4" />GeoJSON</Button>
          </>
        ) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {mode.kind === 'idle' ? (
            <div className="flex flex-wrap gap-2">
              {desktop ? (
                <>
                  {canEditFarm && (boundary
                    ? <Button variant="outline" size="sm" onClick={() => { setDraft(boundary); setMode({ kind: 'edit-boundary' }) }}><Pencil className="h-4 w-4" />Editar limite</Button>
                    : <Button variant="outline" size="sm" onClick={() => setMode({ kind: 'draw-boundary' })}><Shapes className="h-4 w-4" />Desenhar limite</Button>)}
                  {canCreateField && <Button size="sm" onClick={() => setMode({ kind: 'draw-field' })}><Plus className="h-4 w-4" />Novo talhão</Button>}
                  {canCreateField && <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" />Importar KML/KMZ/GeoJSON</Button>}
                  {canEditFarm && <Button variant="outline" size="sm" onClick={() => setMode({ kind: 'add-poi' })}><MapPin className="h-4 w-4" />Ponto de interesse</Button>}
                </>
              ) : (
                <>
                  {canCreateField && <Button className="flex-1" onClick={() => setMode({ kind: 'draw-field' })}><Plus className="h-4 w-4" />Novo talhão</Button>}
                  <Dropdown trigger={<Button variant="outline" className="flex-1"><MoreHorizontal className="h-4 w-4" />Mais opções</Button>}
                    items={[
                      ...(canEditFarm ? [boundary
                        ? { label: 'Editar limite', icon: <Pencil className="h-4 w-4" />, onSelect: () => { setDraft(boundary); setMode({ kind: 'edit-boundary' }) } }
                        : { label: 'Desenhar limite', icon: <Shapes className="h-4 w-4" />, onSelect: () => setMode({ kind: 'draw-boundary' }) }] : []),
                      ...(canCreateField ? [{ label: 'Importar KML/KMZ/GeoJSON', icon: <FileUp className="h-4 w-4" />, onSelect: () => fileRef.current?.click() }] : []),
                      ...(canEditFarm ? [{ label: 'Ponto de interesse', icon: <MapPin className="h-4 w-4" />, onSelect: () => setMode({ kind: 'add-poi' }) }] : []),
                      { label: 'Exportar KML', icon: <Download className="h-4 w-4" />, onSelect: () => exportAll('kml') },
                      { label: 'Exportar GeoJSON', icon: <Download className="h-4 w-4" />, onSelect: () => exportAll('geojson') },
                    ]} />
                </>
              )}
              <input ref={fileRef} type="file" accept=".kml,.kmz,.geojson,.json,.zip" className="hidden" onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm">
              <strong className="text-orange-900">
                {mode.kind === 'draw-boundary' && 'Desenhe o limite: clique para adicionar vértices e clique no primeiro ponto para fechar.'}
                {mode.kind === 'draw-existing' && `Desenhe o polígono de ${fields.data?.find((x) => x.id === mode.fieldId)?.name ?? 'talhão'}.`}
                {mode.kind === 'draw-field' && (draft ? 'Polígono desenhado. Confirme para preencher os dados do talhão.' : 'Desenhe o talhão: clique para adicionar vértices e feche no primeiro ponto.')}
                {(mode.kind === 'edit-boundary' || mode.kind === 'edit-field') && 'Arraste os vértices para ajustar. Clique em salvar ao terminar.'}
                {mode.kind === 'add-poi' && 'Clique no mapa onde fica o ponto de interesse.'}
              </strong>
              {draft && <span className="tabular text-orange-900">Área {formatArea(areaHa(draft))} · Perímetro {formatNumber(perimeterM(draft) / 1000, 2)} km</span>}
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={reset} disabled={busy}><X className="h-4 w-4" />Cancelar</Button>
                {mode.kind !== 'add-poi' && <Button size="sm" onClick={() => void confirmGeometry()} loading={busy} disabled={!draft}>Salvar</Button>}
              </div>
            </div>
          )}
          <FarmMap
            boundary={mode.kind === 'edit-boundary' ? null : boundary}
            fields={mapFields}
            pois={(pois.data ?? []).map((p) => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }))}
            center={f?.latitude && f?.longitude ? [Number(f.latitude), Number(f.longitude)] : null}
            selectedId={selected}
            onFieldClick={(id) => mode.kind === 'idle' && setSelected(id)}
            onMapClick={(lat, lon) => { if (mode.kind === 'add-poi') setPoiDraft({ lat, lon }) }}
            editGeometry={editing}
            drawing={drawing}
            onGeometryChange={(g) => { setDraft(g); if (isDraw && !seed) setSeed(g) }}
            height={desktop ? 'min(70vh, 640px)' : '58dvh'}
            fitKey={activeFarmId}
          />
          <p className="text-[11px] text-muted">
            Mapa base: OpenStreetMap (ruas) e Esri World Imagery (satélite), sujeitos às políticas de uso dos provedores. A imagem de satélite é apenas referência visual — não há monitoramento por satélite ativo nesta versão.
          </p>
        </div>

        <aside className="card flex max-h-[75vh] flex-col overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Talhões ({fields.data?.length ?? 0})</h2>
            <p className="text-xs text-muted">Total mapeado: {formatArea((fields.data ?? []).reduce((s, x) => s + Number(x.area_ha ?? 0), 0))}{boundary && ` · Limite: ${formatArea(f?.boundary_area_ha)}`}</p>
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {(fields.data ?? []).map((x) => {
              const c = crops.data?.get(x.id)
              return (
                <li key={x.id} className={selected === x.id ? 'bg-brand-50/60' : ''}>
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: x.color ?? c?.color ?? '#22c55e' }} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(x.id)}>
                      <div className="truncate text-sm font-medium">{x.name}</div>
                      <div className="text-xs text-muted">
                        {x.geojson ? formatArea(x.area_ha) : <>{formatArea(x.manual_area_ha)} <Badge>sem polígono</Badge></>}
                        {c && ` · ${c.crop}`}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      {canEditField && mode.kind === 'idle' && (
                        <Button variant="ghost" size="icon" aria-label={`Editar geometria de ${x.name}`} title={x.geojson ? 'Editar geometria' : 'Desenhar geometria'}
                          onClick={() => {
                            if (x.geojson) { setDraft(x.geojson as unknown as PolyGeom); setMode({ kind: 'edit-field', fieldId: x.id }) }
                            else setMode({ kind: 'draw-existing', fieldId: x.id })
                          }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Link to={`/talhoes/${x.id}`} className="inline-flex h-9 items-center rounded-lg px-2 text-xs text-brand-700 hover:bg-black/5">Ficha</Link>
                    </div>
                  </div>
                </li>
              )
            })}
            {!fields.isLoading && !fields.data?.length && <li className="px-4 py-6 text-center text-sm text-muted">Nenhum talhão. Use “Novo talhão” ou importe um arquivo.</li>}
          </ul>
        </aside>
      </div>

      <ResourceFormDialog
        open={newFieldOpen}
        onOpenChange={(o) => { setNewFieldOpen(o); if (!o) reset() }}
        title="Novo talhão"
        description={draft ? `Área calculada do polígono: ${formatArea(areaHa(draft))}` : undefined}
        fields={fieldFormFields.filter((x) => x.name !== 'manual_area_ha')}
        defaults={{ irrigation: 'sequeiro', name: `Talhão ${String((fields.data?.length ?? 0) + 1).padStart(2, '0')}` }}
        onSubmit={async (v) => { await createField.mutateAsync({ ...v, geojson: draft }); reset() }}
      />

      <PoiDialog draft={poiDraft} onClose={() => { setPoiDraft(null); setMode({ kind: 'idle' }) }}
        onSave={async (kind, name) => { await createPoi.mutateAsync({ kind, name, lat: poiDraft!.lat, lon: poiDraft!.lon }); setPoiDraft(null); setMode({ kind: 'idle' }) }} />

      <Dialog open={!!importItems} onOpenChange={(o) => !o && setImportItems(null)} title="Importar geometrias" size="lg"
        description="Revise os polígonos encontrados. Você pode usar um deles como limite da propriedade ou criar talhões."
        footer={
          <>
            <Button variant="outline" onClick={() => setImportItems(null)}>Cancelar</Button>
            {canEditFarm && importItems?.filter((i) => i.include).length === 1 && (
              <Button variant="secondary" loading={saveBoundary.isPending} onClick={async () => {
                await saveBoundary.mutateAsync(importItems!.find((i) => i.include)!.geometry); setImportItems(null)
              }}>Usar como limite da propriedade</Button>
            )}
            <Button loading={createField.isPending} disabled={!importItems?.some((i) => i.include)} onClick={async () => {
              const rows = importItems!.filter((i) => i.include)
              try {
                const { error } = await supabase.from('fields').insert(rows.map((r) => ({ organization_id: orgId, farm_id: activeFarmId!, name: r.newName.trim() || 'Talhão importado', geojson: r.geometry as never, irrigation: 'sequeiro' })))
                if (error) throw error
                toast.success(`${rows.length} talhão(ões) importado(s)`)
                setImportItems(null)
                void fields.refetch()
              } catch (e) { toast.error(toUserMessage(e)) }
            }}>Criar {importItems?.filter((i) => i.include).length ?? 0} talhão(ões)</Button>
          </>
        }>
        <ul className="divide-y divide-line">
          {importItems?.map((it, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={it.include} aria-label={`Incluir ${it.newName}`}
                onChange={(e) => setImportItems((arr) => arr!.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
              <Input value={it.newName} onChange={(e) => setImportItems((arr) => arr!.map((x, j) => (j === i ? { ...x, newName: e.target.value } : x)))} className="h-9 flex-1" aria-label="Nome" />
              <span className="w-28 text-right text-sm tabular">{formatArea(it.area)}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}

function PoiDialog({ draft, onClose, onSave }: { draft: { lat: number; lon: number } | null; onClose: () => void; onSave: (kind: string, name: string) => Promise<void> }) {
  const [kind, setKind] = useState('sede')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()} title="Novo ponto de interesse" size="sm"
      description={draft ? `Lat ${draft.lat.toFixed(5)}, Lon ${draft.lon.toFixed(5)}` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!name.trim()} onClick={async () => { setBusy(true); try { await onSave(kind, name.trim()); setName('') } finally { setBusy(false) } }}>Salvar</Button></>}>
      <div className="space-y-3">
        <FieldWrap label="Tipo" htmlFor="poi-kind"><Select id="poi-kind" value={kind} onChange={(e) => setKind(e.target.value)}>{POI_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></FieldWrap>
        <FieldWrap label="Nome" htmlFor="poi-name" required><Input id="poi-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></FieldWrap>
      </div>
    </Dialog>
  )
}
