import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import type { PolyGeom } from '@/utils/geo'
import { cn } from '@/lib/cn'

export interface MapPolygon { id: string; name: string; geometry: PolyGeom | null; color?: string | null; subtitle?: string }
export interface MapPoi { id: string; name: string; kind: string; latitude: number; longitude: number }

const POI_COLORS: Record<string, string> = {
  sede: '#14532d', galpao: '#6b7280', silo: '#d97706', poco: '#0284c7', reservatorio: '#0369a1', estrada: '#78716c',
  ponte: '#57534e', acesso: '#a16207', estacao_meteorologica: '#0e7490', rio: '#0ea5e9', construcao: '#525252', outro: '#404040',
}

/**
 * Mapa da propriedade (Leaflet). Camadas: ruas (OpenStreetMap) e imagem de satélite (Esri World Imagery).
 * Modo de desenho/edição via Geoman. Geometrias trafegam como GeoJSON (WGS84).
 */
export function FarmMap({
  boundary, fields = [], pois = [], center, selectedId, onFieldClick, onMapClick,
  editGeometry, drawing, onGeometryChange, className, height = 480, fitKey,
}: {
  boundary?: PolyGeom | null
  fields?: MapPolygon[]
  pois?: MapPoi[]
  center?: [number, number] | null
  selectedId?: string | null
  onFieldClick?: (id: string) => void
  onMapClick?: (lat: number, lon: number) => void
  /** geometria em edição (aparece editável) */
  editGeometry?: PolyGeom | null
  /** ativa o desenho de um novo polígono */
  drawing?: boolean
  onGeometryChange?: (g: PolyGeom | null) => void
  className?: string
  height?: number | string
  /** muda para forçar novo enquadramento */
  fitKey?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const overlay = useRef<L.FeatureGroup | null>(null)
  const editLayer = useRef<L.Layer | null>(null)
  const cbs = useRef({ onFieldClick, onMapClick, onGeometryChange })
  cbs.current = { onFieldClick, onMapClick, onGeometryChange }
  const fitted = useRef<string | null>(null)

  // Inicialização
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, preferCanvas: false }).setView(center ?? [-15.8, -47.9], center ? 13 : 4)
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics',
    })
    sat.addTo(m)
    L.control.layers({ 'Satélite': sat, 'Ruas (OSM)': streets }, {}, { position: 'topright' }).addTo(m)
    L.control.scale({ imperial: false }).addTo(m)
    overlay.current = L.featureGroup().addTo(m)
    m.pm.setLang('pt_br')
    m.pm.setGlobalOptions({ snappable: true, allowSelfIntersection: false })
    m.on('click', (e: L.LeafletMouseEvent) => cbs.current.onMapClick?.(e.latlng.lat, e.latlng.lng))
    m.on('pm:create', (e) => {
      const layer = (e as unknown as { layer: L.Polygon }).layer
      const gj = layer.toGeoJSON().geometry as PolyGeom
      m.removeLayer(layer)
      cbs.current.onGeometryChange?.(gj)
    })
    map.current = m
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Camadas de dados
  useEffect(() => {
    const m = map.current, g = overlay.current
    if (!m || !g) return
    g.clearLayers()
    if (boundary) {
      L.geoJSON(boundary as GeoJSON.Geometry, { style: { color: '#fde68a', weight: 3, dashArray: '6 4', fillOpacity: 0.04 }, pmIgnore: true } as L.GeoJSONOptions)
        .bindTooltip('Limite da propriedade', { sticky: true }).addTo(g)
    }
    for (const f of fields) {
      if (!f.geometry) continue
      const sel = f.id === selectedId
      const layer = L.geoJSON(f.geometry as GeoJSON.Geometry, {
        style: { color: sel ? '#ffffff' : (f.color ?? '#22c55e'), weight: sel ? 3 : 2, fillColor: f.color ?? '#22c55e', fillOpacity: sel ? 0.45 : 0.3 },
        pmIgnore: true,
      } as L.GeoJSONOptions)
      layer.bindTooltip(`<strong>${escapeHtml(f.name)}</strong>${f.subtitle ? `<br/>${escapeHtml(f.subtitle)}` : ''}`, { sticky: true })
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); cbs.current.onFieldClick?.(f.id) })
      layer.addTo(g)
    }
    for (const p of pois) {
      L.circleMarker([p.latitude, p.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: POI_COLORS[p.kind] ?? '#404040', fillOpacity: 1, pmIgnore: true } as L.CircleMarkerOptions)
        .bindTooltip(escapeHtml(p.name)).addTo(g)
    }
    const b = g.getBounds()
    // Reenquadra quando a propriedade muda ou quando os limites dos dados mudam (ex.: dados atualizados do servidor)
    const key = `${fitKey ?? 'default'}|${b.isValid() ? b.toBBoxString().split(',').map((n) => Number(n).toFixed(3)).join(',') : 'empty'}`
    if (fitted.current !== key) {
      // Recalcula o tamanho do container antes de enquadrar (layout pode ainda estar assentando)
      const fit = () => {
        m.invalidateSize()
        if (b.isValid()) m.fitBounds(b.pad(0.1))
        else if (center) m.setView(center, 13)
      }
      if (b.isValid() || center) {
        fit()
        requestAnimationFrame(fit)
        setTimeout(fit, 250)
        fitted.current = key
      }
    }
  }, [boundary, fields, pois, selectedId, center, fitKey])

  // Edição de geometria existente
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (editLayer.current) { m.removeLayer(editLayer.current); editLayer.current = null }
    if (!editGeometry) return
    const gj = L.geoJSON(editGeometry as GeoJSON.Geometry, { style: { color: '#f97316', weight: 3, fillOpacity: 0.2 } })
    const layers = gj.getLayers() as L.Polygon[]
    const layer = layers[0]
    if (!layer) return
    layer.addTo(m)
    layer.pm.enable({ allowSelfIntersection: false })
    const emit = () => cbs.current.onGeometryChange?.(layer.toGeoJSON().geometry as PolyGeom)
    layer.on('pm:edit', emit)
    layer.on('pm:markerdragend', emit)
    editLayer.current = layer
    m.fitBounds(layer.getBounds().pad(0.3))
    return () => { layer.off(); layer.pm.disable() }
  }, [editGeometry])

  // Desenho
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (drawing) m.pm.enableDraw('Polygon', { snappable: true, templineStyle: { color: '#f97316' }, hintlineStyle: { color: '#f97316', dashArray: [5, 5] } })
    else m.pm.disableDraw()
  }, [drawing])

  useEffect(() => { setTimeout(() => map.current?.invalidateSize(), 50) }, [height])

  return <div ref={el} className={cn('w-full overflow-hidden rounded-xl border border-line bg-[#dfe7dc]', className)} style={{ height }} role="region" aria-label="Mapa da propriedade" />
}

function escapeHtml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!))
}
