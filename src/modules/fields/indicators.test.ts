import { describe, expect, it } from 'vitest'
import { fieldIndicators } from './indicators'

describe('indicadores por talhão', () => {
  const fields = [{ id: 'a', name: 'T1', area: 100 }, { id: 'b', name: 'T2', area: 50 }]
  const acts = [
    { field_id: 'a', season_id: 's1', labor_cost: 1000, other_cost: 0, inputs_cost: '9000' },
    { field_id: 'a', season_id: 's2', labor_cost: 500, other_cost: 0, inputs_cost: 0 },
    { field_id: 'b', season_id: 's1', labor_cost: 200, other_cost: 300, inputs_cost: 0 },
  ]
  const txs = [
    { field_id: 'a', season_id: 's1', kind: 'despesa', amount: '2000', status: 'pago' },
    { field_id: 'a', season_id: 's1', kind: 'despesa', amount: '99999', status: 'cancelado' },
    { field_id: 'a', season_id: 's1', kind: 'receita', amount: '50000', status: 'pendente' },
  ]
  const harvests = [{ field_id: 'a', season_id: 's1', quantity_kg: 360000 }]

  it('soma custos de atividades e despesas diretas por safra', () => {
    const [a, b] = fieldIndicators(fields, acts, txs, harvests, 60, 's1')
    expect(a.totalCost).toBe(12000)
    expect(a.costPerHa).toBe(120)
    expect(a.revenue).toBe(50000)
    expect(a.productionSc).toBe(6000)
    expect(a.yieldScHa).toBe(60)
    expect(b.totalCost).toBe(500)
    expect(b.yieldScHa).toBeNull()
  })
  it('sem peso de saca não calcula sacas', () => {
    const [a] = fieldIndicators(fields, acts, txs, harvests, null)
    expect(a.productionKg).toBe(360000)
    expect(a.productionSc).toBeNull()
    expect(a.totalCost).toBe(12500)
  })
})
