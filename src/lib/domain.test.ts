import { describe, expect, it } from 'vitest'
import { convertArea, convertWeight } from './units'
import { breakEven, costPerHectare, financing, fertilizer, irrigation, seeds, spraying } from './calculators'
import { monthlyCashflow, splitInstallments, summarize } from './finance'
import { toUserMessage } from './errors'

describe('unidades', () => {
  it('converte alqueire paulista para hectare', () => {
    expect(convertArea(10, 'alq_paulista', 'ha')).toBeCloseTo(24.2)
    expect(convertArea(24.2, 'ha', 'alq_paulista')).toBeCloseTo(10)
  })
  it('exige peso da saca para converter sacas', () => {
    expect(() => convertWeight(10, 'sc', 'kg')).toThrow(/peso da saca/)
    expect(convertWeight(10, 'sc', 'kg', 60)).toBe(600)
    expect(convertWeight(1, 't', 'sc', 60)).toBeCloseTo(16.667, 2)
    expect(convertWeight(30, 'kg', '@')).toBe(2)
  })
})

describe('calculadoras', () => {
  it('custo por hectare e ponto de equilíbrio', () => {
    expect(costPerHectare(500000, 100)).toBe(5000)
    expect(Number.isNaN(costPerHectare(1, 0))).toBe(true)
    const be = breakEven(600000, 6000, 120)
    expect(be.minPrice).toBe(100)
    expect(be.minProduction).toBe(5000)
  })
  it('sementes por metro e kg/ha', () => {
    const r = seeds({ population: 300000, germinationPct: 90, emergencePct: 90, rowSpacingM: 0.5, tsw: 180, areaHa: 10 })
    expect(r.seedsPerHa).toBeCloseTo(370370.37, 1)
    expect(r.seedsPerMeter).toBeCloseTo(18.52, 2)
    expect(r.kgPerHa).toBeCloseTo(66.67, 2)
    expect(r.totalKg).toBeCloseTo(666.67, 1)
  })
  it('adubação e pulverização', () => {
    expect(fertilizer({ nutrientDoseKgHa: 100, productConcentrationPct: 52, areaHa: 10 }).productKgHa).toBeCloseTo(192.31, 2)
    const s = spraying({ sprayVolumeLHa: 100, tankCapacityL: 2000, doseHa: 2, areaHa: 50 })
    expect(s.areaPerTank).toBe(20)
    expect(s.productPerTank).toBe(40)
    expect(s.tanks).toBe(2.5)
  })
  it('irrigação: 1 mm/ha = 10 m³', () => {
    expect(irrigation({ etoMmDay: 5, kc: 1, efficiencyPct: 100, areaHa: 1, days: 1 }).m3PerDay).toBe(50)
  })
  it('financiamento Price e SAC quitam o principal', () => {
    const price = financing({ principal: 100000, ratePct: 1, periods: 12, system: 'price' })
    expect(price.rows.at(-1)!.balance).toBeCloseTo(0, 6)
    expect(price.rows[0].payment).toBeCloseTo(8884.88, 2)
    const sac = financing({ principal: 120000, ratePct: 1, periods: 12, system: 'sac' })
    expect(sac.rows[0].payment).toBeCloseTo(11200, 2)
    expect(sac.rows.at(-1)!.balance).toBeCloseTo(0, 6)
  })
})

describe('financeiro', () => {
  const txs = [
    { kind: 'receita', amount: '1000', status: 'pago', due_date: '2026-10-01', paid_date: '2026-10-02' },
    { kind: 'receita', amount: '500', status: 'pendente', due_date: '2026-11-01' },
    { kind: 'despesa', amount: '300', status: 'pendente', due_date: '2026-11-30' },
    { kind: 'despesa', amount: '200', status: 'pago', due_date: '2026-10-05', paid_date: '2026-10-05' },
    { kind: 'despesa', amount: '999', status: 'cancelado', due_date: '2026-10-05' },
  ]
  it('ignora cancelados e calcula saldos', () => {
    const s = summarize(txs, '2026-11-24')
    expect(s.revenue).toBe(1500)
    expect(s.expense).toBe(500)
    expect(s.result).toBe(1000)
    expect(s.cashBalance).toBe(800)
    expect(s.overdueReceivable).toBe(500)
    expect(s.overduePayable).toBe(0)
  })
  it('fluxo mensal', () => {
    expect(monthlyCashflow(txs)).toEqual([
      { month: '2026-10', receitas: 1000, despesas: 200, saldo: 800 },
      { month: '2026-11', receitas: 500, despesas: 300, saldo: 200 },
    ])
  })
  it('parcelas somam o total exato', () => {
    const p = splitInstallments(100, 3)
    expect(p).toEqual([33.33, 33.33, 33.34])
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10)
  })
})

describe('mensagens de erro', () => {
  it('preserva mensagens de regra de negócio do banco', () => {
    expect(toUserMessage({ code: '23514', message: 'Saldo insuficiente de "Diesel"' })).toBe('Saldo insuficiente de "Diesel"')
  })
  it('traduz violação de RLS', () => {
    expect(toUserMessage({ code: '42501', message: 'new row violates row-level security policy' })).toMatch(/permissão/)
  })
})
