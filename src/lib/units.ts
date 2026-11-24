/** Conversões de unidades agrícolas. Toda conversão é explícita; peso de saca nunca é presumido. */

export const AREA_UNITS = {
  ha: { label: 'Hectare (ha)', toHa: 1 },
  alq_paulista: { label: 'Alqueire paulista (2,42 ha)', toHa: 2.42 },
  alq_mineiro: { label: 'Alqueire mineiro/goiano (4,84 ha)', toHa: 4.84 },
  alq_baiano: { label: 'Alqueire baiano (9,68 ha)', toHa: 9.68 },
  acre: { label: 'Acre (0,404686 ha)', toHa: 0.40468564224 },
  m2: { label: 'Metro quadrado (m²)', toHa: 0.0001 },
} as const
export type AreaUnit = keyof typeof AREA_UNITS

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return (value * AREA_UNITS[from].toHa) / AREA_UNITS[to].toHa
}

export type WeightUnit = 'kg' | 't' | 'sc' | '@' | 'g'

/** Converte peso. `sackKg` é obrigatório quando a origem ou o destino é saca. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit, sackKg?: number | null): number {
  const toKg = (u: WeightUnit): number => {
    switch (u) {
      case 'kg': return 1
      case 'g': return 0.001
      case 't': return 1000
      case '@': return 15
      case 'sc':
        if (!sackKg || sackKg <= 0) throw new Error('Informe o peso da saca (kg) para converter sacas.')
        return sackKg
    }
  }
  return (value * toKg(from)) / toKg(to)
}

export const QUANTITY_UNITS = ['kg', 't', 'g', 'L', 'mL', 'un', 'sc', 'cx', 'm', 'bag'] as const
