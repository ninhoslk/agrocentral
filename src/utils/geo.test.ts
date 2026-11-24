import { describe, expect, it } from 'vitest'
import { areaHa, extractPolygons, perimeterM, toKML, validatePolygon } from './geo'
import type { Polygon } from 'geojson'

// Quadrado de ~1 km x 1 km perto do equador (0,009° ≈ 1 km)
const square: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [0.009, 0], [0.009, 0.009], [0, 0.009], [0, 0]]] }

describe('geo', () => {
  it('calcula área e perímetro aproximados', () => {
    expect(areaHa(square)).toBeGreaterThan(99)
    expect(areaHa(square)).toBeLessThan(101)
    expect(perimeterM(square)).toBeGreaterThan(3990)
    expect(perimeterM(square)).toBeLessThan(4020)
  })
  it('extrai polígonos com nome de FeatureCollection', () => {
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'T1' }, geometry: square }, { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }] }
    const r = extractPolygons(fc)
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('T1')
  })
  it('valida coordenadas e anéis', () => {
    expect(validatePolygon(square)).toBeNull()
    expect(validatePolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] })).toMatch(/vértices/)
    expect(validatePolygon({ type: 'Polygon', coordinates: [[[0, 0], [200, 0], [1, 1], [0, 0]]] })).toMatch(/inválidas/)
  })
  it('gera KML escapando nomes', () => {
    const k = toKML([{ name: 'Talhão <1> & "A"', geometry: square }])
    expect(k).toContain('Talhão &lt;1&gt; &amp; &quot;A&quot;')
    expect(k).toContain('<coordinates>0,0,0 0.009,0,0')
  })
})
