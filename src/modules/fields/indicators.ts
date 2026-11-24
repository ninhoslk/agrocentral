/** Indicadores por talhão/safra (custos, produção, produtividade) a partir de registros reais. */
export interface ActivityCost { field_id: string | null; season_id: string | null; labor_cost: number | string; other_cost: number | string; inputs_cost: number | string }
export interface TxCost { field_id: string | null; season_id: string | null; kind: string; amount: number | string; status: string }
export interface Harvest { field_id: string; season_id: string; quantity_kg: number | string | null }
export interface FieldArea { id: string; name: string; area: number }

export interface FieldIndicator {
  fieldId: string
  name: string
  areaHa: number
  operationCost: number
  directExpenses: number
  revenue: number
  totalCost: number
  costPerHa: number | null
  productionKg: number
  productionSc: number | null
  yieldScHa: number | null
}

/**
 * Custo do talhão = custos das atividades (mão de obra + insumos + outros) + despesas lançadas diretamente no talhão.
 * Produtividade em sc/ha usa o peso da saca informado (sem presumir).
 */
export function fieldIndicators(fields: FieldArea[], acts: ActivityCost[], txs: TxCost[], harvests: Harvest[], sackKg: number | null, seasonId?: string | null): FieldIndicator[] {
  return fields.map((f) => {
    const a = acts.filter((x) => x.field_id === f.id && (!seasonId || x.season_id === seasonId))
    const t = txs.filter((x) => x.field_id === f.id && x.status !== 'cancelado' && (!seasonId || x.season_id === seasonId))
    const h = harvests.filter((x) => x.field_id === f.id && (!seasonId || x.season_id === seasonId))
    const operationCost = a.reduce((s, x) => s + Number(x.labor_cost) + Number(x.other_cost) + Number(x.inputs_cost), 0)
    const directExpenses = t.filter((x) => x.kind === 'despesa').reduce((s, x) => s + Number(x.amount), 0)
    const revenue = t.filter((x) => x.kind === 'receita').reduce((s, x) => s + Number(x.amount), 0)
    const productionKg = h.reduce((s, x) => s + Number(x.quantity_kg ?? 0), 0)
    const totalCost = operationCost + directExpenses
    const productionSc = sackKg ? productionKg / sackKg : null
    return {
      fieldId: f.id, name: f.name, areaHa: f.area, operationCost, directExpenses, revenue, totalCost,
      costPerHa: f.area > 0 ? totalCost / f.area : null,
      productionKg, productionSc,
      yieldScHa: productionSc !== null && f.area > 0 && productionKg > 0 ? productionSc / f.area : null,
    }
  })
}
