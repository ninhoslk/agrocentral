import turfArea from '@turf/area'
import turfLength from '@turf/length'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson'

export type PolyGeom = Polygon | MultiPolygon

/** Área geodésica em hectares */
export function areaHa(g: Geometry | Feature | FeatureCollection | null | undefined): number {
  if (!g) return 0
  return turfArea(g as Feature) / 10000
}

/** Perímetro em metros (soma dos anéis externos) */
export function perimeterM(g: PolyGeom | null | undefined): number {
  if (!g) return 0
  const polys: Position[][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.reduce((sum, rings) => sum + turfLength({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: rings[0] } }, { units: 'kilometers' }) * 1000, 0)
}

/** Extrai polígonos de qualquer GeoJSON (Feature, FeatureCollection, Geometry) */
export function extractPolygons(input: unknown): { geometry: PolyGeom; name?: string }[] {
  const out: { geometry: PolyGeom; name?: string }[] = []
  const visit = (node: unknown, name?: string) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; features?: unknown[]; geometry?: unknown; properties?: Record<string, unknown>; geometries?: unknown[] }
    if (n.type === 'FeatureCollection') n.features?.forEach((f) => visit(f))
    else if (n.type === 'Feature') {
      const nm = (n.properties?.name ?? n.properties?.Name ?? n.properties?.NOME ?? n.properties?.nome) as string | undefined
      visit(n.geometry, nm)
    } else if (n.type === 'GeometryCollection') n.geometries?.forEach((g) => visit(g, name))
    else if (n.type === 'Polygon' || n.type === 'MultiPolygon') out.push({ geometry: n as PolyGeom, name })
  }
  visit(input)
  return out
}

/** Valida coordenadas (lon/lat em WGS84) e fechamento dos anéis */
export function validatePolygon(g: PolyGeom): string | null {
  const polys: Position[][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const rings of polys) {
    for (const ring of rings) {
      if (ring.length < 4) return 'Polígono com menos de 3 vértices'
      for (const [lon, lat] of ring) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return 'Coordenadas inválidas (use WGS84 lon/lat)'
      }
    }
  }
  return null
}

/** Lê arquivo GeoJSON, KML ou KMZ e devolve os polígonos encontrados */
export async function parseGeoFile(file: File): Promise<{ geometry: PolyGeom; name?: string }[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB')
  const name = file.name.toLowerCase()
  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    return extractPolygons(JSON.parse(await file.text()))
  }
  const { kml } = await import('@tmcw/togeojson')
  if (name.endsWith('.kml')) {
    const dom = new DOMParser().parseFromString(await file.text(), 'text/xml')
    return extractPolygons(kml(dom))
  }
  if (name.endsWith('.kmz')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    const entry = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.kml'))
    if (!entry) throw new Error('KMZ sem arquivo KML interno')
    const dom = new DOMParser().parseFromString(await entry.async('text'), 'text/xml')
    return extractPolygons(kml(dom))
  }
  if (name.endsWith('.zip') || name.endsWith('.shp')) {
    throw new Error('Shapefile ainda não é suportado diretamente. Converta para GeoJSON ou KML (ex.: QGIS) e importe novamente.')
  }
  throw new Error('Formato não suportado. Use GeoJSON, KML ou KMZ.')
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))

export function toKML(features: { name: string; geometry: PolyGeom; description?: string }[], docName = 'AgroCentral'): string {
  const ring = (r: Position[]) => r.map(([x, y]) => `${x},${y},0`).join(' ')
  const poly = (rings: Position[][]) =>
    `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring(rings[0])}</coordinates></LinearRing></outerBoundaryIs>${rings
      .slice(1).map((r) => `<innerBoundaryIs><LinearRing><coordinates>${ring(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`
  const pm = features.map((f) => {
    const geom = f.geometry.type === 'Polygon' ? poly(f.geometry.coordinates) : `<MultiGeometry>${f.geometry.coordinates.map(poly).join('')}</MultiGeometry>`
    return `<Placemark><name>${esc(f.name)}</name>${f.description ? `<description>${esc(f.description)}</description>` : ''}${geom}</Placemark>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(docName)}</name>${pm}</Document></kml>`
}

export function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
