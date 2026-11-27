import { describe, expect, it } from 'vitest'
import { applyScenario, groupBy, insights, lineTotal, monthlySeries, totals, type ActualTx, type BudgetLine } from './budget'

const L = (o: Partial<BudgetLine>): BudgetLine => ({
  id: crypto.randomUUID(), kind: 'despesa', expense_type: 'custeio', description: 'x', category_id: 'fert', category_name: 'Fertilizantes',
  farm_id: 'f1', season_id: 's1', field_id: null, crop_id: 'soja', quantity: 1, unit_price: 0, total_amount: 0, planned_date: '2026-10-10',
  status: 'previsto', installments: 1, realized_amount: 0, ...o,
  ...(o.total_amount === undefined ? { total_amount: lineTotal(o.quantity ?? 1, o.unit_price ?? 0) } : {}),
})
const T = (o: Partial<ActualTx>): ActualTx => ({ kind: 'despesa', amount: 0, status: 'pago', due_date: '2026-10-15', paid_date: '2026-10-15', category_id: 'fert', ...o })

const lines = [
  L({ id: 'a', category_id: 'fert', category_name: 'Fertilizantes', quantity: 20, unit_price: 3000 }), // 60.000
  L({ id: 'b', category_id: 'sem', category_name: 'Sementes', quantity: 100, unit_price: 400, installments: 2 }), // 40.000
  L({ id: 'c', category_id: 'maq', category_name: 'Máquinas', expense_type: 'investimento', quantity: 1, unit_price: 50000, status: 'aprovado' }),
  L({ id: 'd', category_id: 'x', quantity: 1, unit_price: 9999, status: 'cancelado' }),
  L({ id: 'r', kind: 'receita', expense_type: 'receita', category_id: 'venda', category_name: 'Venda de grãos', unit: 'sc', quantity: 6000, unit_price: 120 }), // 720.000
]

describe('orçamento — cálculos', () => {
  it('quantidade × valor unitário com centavos', () => {
    expect(lineTotal(3, 0.335)).toBe(1.01)
    expect(lineTotal('2,5'.replace(',', '.'), 10)).toBe(25)
  })

  it('totais ignoram cancelados e separam investimento e receita', () => {
    const t = totals(lines, [T({ amount: 66000 })], 100)
    expect(t.plannedExpense).toBe(150000)
    expect(t.plannedInvestment).toBe(50000)
    expect(t.plannedRevenue).toBe(720000)
    expect(t.realizedExpense).toBe(66000)
    expect(t.costPerHa).toBe(1500)
    expect(t.executionPct).toBeCloseTo(44)
    // ponto de equilíbrio: 150.000 / 6.000 sc = R$ 25/sc; 150.000/120 = 1.250 sc / 100 ha = 12,5 sc/ha
    expect(t.breakEvenPrice).toBe(25)
    expect(t.breakEvenYield).toBe(12.5)
  })

  it('pendente desconta o realizado vinculado à linha', () => {
    const ls = [L({ id: 'a', quantity: 1, unit_price: 1000, realized_amount: 400 }), L({ id: 'b', quantity: 1, unit_price: 500, status: 'realizado', actual_date: '2026-10-01' })]
    const t = totals(ls, [T({ amount: 400, budget_line_id: 'a', status: 'pendente', paid_date: null })], 0)
    expect(t.pendingExpense).toBe(600)
    expect(t.payableOpen).toBe(400)
    expect(t.cashNeeded).toBe(1000)
    expect(t.costPerHa).toBeNull()
  })

  it('agrupa por categoria com desvio e participação', () => {
    const g = groupBy(lines, [T({ amount: 66000, category_id: 'fert' }), T({ amount: 1000, category_id: 'luz' })], 'category', (k) => k)
    const fert = g.find((r) => r.key === 'fert')!
    expect(fert.planned).toBe(60000)
    expect(fert.variance).toBe(6000)
    expect(fert.variancePct).toBeCloseTo(10)
    expect(fert.sharePct).toBeCloseTo(40)
    expect(g.find((r) => r.key === 'luz')!.planned).toBe(0)
  })

  it('série mensal distribui parcelas e acumula', () => {
    const s = monthlySeries(lines, [])
    expect(s.find((m) => m.month === '2026-10')!.orcado).toBe(60000 + 20000 + 50000)
    expect(s.find((m) => m.month === '2026-11')!.orcado).toBe(20000)
    expect(s.at(-1)!.orcadoAcum).toBe(150000)
  })

  it('cenário ajusta preço, produtividade, custo e categoria', () => {
    const base = applyScenario(lines, { name: 'base', price_pct: 0, yield_pct: 0, cost_pct: 0 })
    expect(base.result).toBe(570000)
    const c = applyScenario(lines, { name: 'c', price_pct: -10, yield_pct: -10, cost_pct: 10, category_pct: { fert: -10 }, extra_investment: 1000 })
    // receita 6000*0,9*120*0,9 = 583.200; custos 60.000*1,0 + 40.000*1,1 + 50.000*1,1 + 1.000 = 160.000
    expect(c.revenue).toBe(583200)
    expect(c.expense).toBe(160000)
  })

  it('insights explicam a origem e pedem dados que faltam', () => {
    const empty = insights(totals([], [], 0), [], [], '2026-11-27')
    expect(empty[0].title).toMatch(/Cadastre/)
    const g = groupBy(lines, [T({ amount: 66000 })], 'category', (k) => k)
    const ins = insights(totals(lines, [T({ amount: 66000 })], 0), g, lines, '2026-11-27', { cash: 10000 })
    expect(ins.some((i) => i.tone === 'bad' && i.title.includes('acima do orçado'))).toBe(true)
    expect(ins.some((i) => i.title.includes('saldo em caixa'))).toBe(true)
    expect(ins.some((i) => i.title === 'Área não informada')).toBe(true)
    expect(ins.every((i) => i.source.length > 0)).toBe(true)
  })
})
