/**
 * Orçamento rural — cálculos puros (MICRO → MACRO → RESUMO).
 *
 * Fonte dos dados:
 *  - ORÇADO: linhas de budget_lines (total = quantidade × valor unitário, calculado no banco).
 *  - REALIZADO: lançamentos do Financeiro (transactions), vinculados ou não a uma linha.
 * Nada aqui inventa valores: quando falta informação, as funções devolvem null e o motivo.
 */
import { splitInstallments } from './finance'

export interface BudgetLine {
  id: string
  kind: 'despesa' | 'receita' | string
  expense_type: string
  description: string
  category_id: string
  category_name: string
  subcategory?: string | null
  farm_id: string | null
  season_id: string | null
  field_id: string | null
  crop_id: string | null
  activity_id?: string | null
  contact_id?: string | null
  unit?: string | null
  quantity: number | string
  unit_price: number | string
  total_amount: number | string
  planned_date: string
  actual_date?: string | null
  installments?: number | null
  status: 'previsto' | 'aprovado' | 'realizado' | 'cancelado' | string
  is_extraordinary?: boolean | null
  realized_amount?: number | string | null
  paid_amount?: number | string | null
}

export interface ActualTx {
  kind: string
  amount: number | string
  status: string
  due_date: string
  paid_date?: string | null
  category_id: string
  category_name?: string | null
  farm_id?: string | null
  season_id?: string | null
  field_id?: string | null
  crop_id?: string | null
  activity_id?: string | null
  budget_line_id?: string | null
}

export interface Scenario {
  id?: string
  name: string
  kind?: string
  price_pct: number | string
  yield_pct: number | string
  cost_pct: number | string
  category_pct?: Record<string, number | string> | null
  extra_investment?: number | string | null
}

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (v: number) => Math.round(v * 100) / 100

/** Valor total de uma linha (espelha a coluna gerada do banco). */
export const lineTotal = (quantity: number | string, unitPrice: number | string) => round2(n(quantity) * n(unitPrice))

const active = (l: BudgetLine) => l.status !== 'cancelado'

// ---------------------------------------------------------------------------
// MACRO — consolidação por dimensão
// ---------------------------------------------------------------------------
export type Dimension = 'category' | 'subcategory' | 'farm' | 'season' | 'crop' | 'field' | 'activity' | 'expense_type' | 'month'

export interface GroupRow {
  key: string
  label: string
  planned: number
  realized: number
  /** orçado ainda não executado (planejado − realizado, nunca negativo) */
  pending: number
  variance: number
  variancePct: number | null
  sharePct: number
  lines: number
}

function keyOf(dim: Dimension, x: { category_id?: string; subcategory?: string | null; farm_id?: string | null; season_id?: string | null; crop_id?: string | null; field_id?: string | null; activity_id?: string | null; expense_type?: string; date?: string }) {
  switch (dim) {
    case 'category': return x.category_id ?? ''
    case 'subcategory': return x.subcategory || '—'
    case 'farm': return x.farm_id ?? ''
    case 'season': return x.season_id ?? ''
    case 'crop': return x.crop_id ?? ''
    case 'field': return x.field_id ?? ''
    case 'activity': return x.activity_id ?? ''
    case 'expense_type': return x.expense_type ?? 'custeio'
    case 'month': return (x.date ?? '').slice(0, 7)
  }
}

/**
 * Agrupa ORÇADO (linhas) e REALIZADO (Financeiro) de despesas pela dimensão escolhida.
 * Realizado = lançamentos de despesa não cancelados (vinculados ou não ao orçamento).
 */
export function groupBy(lines: BudgetLine[], actuals: ActualTx[], dim: Dimension, labels: (key: string) => string, kind: 'despesa' | 'receita' = 'despesa'): GroupRow[] {
  const map = new Map<string, GroupRow>()
  const get = (k: string) => {
    let r = map.get(k)
    if (!r) { r = { key: k, label: labels(k), planned: 0, realized: 0, pending: 0, variance: 0, variancePct: null, sharePct: 0, lines: 0 }; map.set(k, r) }
    return r
  }
  const lineById = new Map(lines.map((l) => [l.id, l]))
  for (const l of lines) {
    if (!active(l) || l.kind !== kind) continue
    const r = get(keyOf(dim, { ...l, date: l.planned_date }))
    r.planned += n(l.total_amount); r.lines += 1
  }
  for (const t of actuals) {
    if (t.status === 'cancelado' || t.kind !== kind) continue
    // tipo de despesa/subcategoria só existem no orçamento: herda da linha vinculada
    const linked = t.budget_line_id ? lineById.get(t.budget_line_id) : undefined
    const r = get(keyOf(dim, {
      ...t, expense_type: linked?.expense_type ?? (kind === 'receita' ? 'receita' : 'custeio'), subcategory: linked?.subcategory ?? null,
      date: t.status === 'pago' && t.paid_date ? t.paid_date : t.due_date,
    }))
    r.realized += n(t.amount)
  }
  const totalPlanned = [...map.values()].reduce((a, r) => a + r.planned, 0)
  const totalRealized = [...map.values()].reduce((a, r) => a + r.realized, 0)
  const base = totalPlanned || totalRealized
  return [...map.values()].map((r) => {
    const planned = round2(r.planned), realized = round2(r.realized)
    return {
      ...r, planned, realized,
      pending: round2(Math.max(planned - realized, 0)),
      variance: round2(realized - planned),
      variancePct: planned > 0 ? ((realized - planned) / planned) * 100 : null,
      sharePct: base ? ((totalPlanned ? planned : realized) / base) * 100 : 0,
    }
  }).sort((a, b) => (b.planned || b.realized) - (a.planned || a.realized))
}

/** Série mensal orçado × realizado (despesas), considerando o parcelamento previsto da linha. */
export function monthlySeries(lines: BudgetLine[], actuals: ActualTx[]) {
  const map = new Map<string, { month: string; orcado: number; realizado: number }>()
  const add = (m: string, k: 'orcado' | 'realizado', v: number) => {
    const r = map.get(m) ?? { month: m, orcado: 0, realizado: 0 }
    r[k] = round2(r[k] + v); map.set(m, r)
  }
  for (const l of lines) {
    if (!active(l) || l.kind !== 'despesa') continue
    const parts = splitInstallments(n(l.total_amount), Math.max(1, n(l.installments) || 1))
    const [y, m] = l.planned_date.split('-').map(Number)
    parts.forEach((v, i) => {
      const d = new Date(y, m - 1 + i, 1)
      add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 'orcado', v)
    })
  }
  for (const t of actuals) {
    if (t.status === 'cancelado' || t.kind !== 'despesa') continue
    add((t.status === 'pago' && t.paid_date ? t.paid_date : t.due_date).slice(0, 7), 'realizado', n(t.amount))
  }
  let accO = 0, accR = 0
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => {
    accO += r.orcado; accR += r.realizado
    return { ...r, orcadoAcum: round2(accO), realizadoAcum: round2(accR) }
  })
}

// ---------------------------------------------------------------------------
// RESUMO — indicadores
// ---------------------------------------------------------------------------
export interface Totals {
  plannedExpense: number
  plannedRevenue: number
  plannedInvestment: number
  realizedExpense: number
  paidExpense: number
  realizedRevenue: number
  /** quanto do orçado ainda não foi executado */
  pendingExpense: number
  /** lançamentos de despesa ainda não pagos no Financeiro */
  payableOpen: number
  /** valor a desembolsar = orçado não executado + contas em aberto */
  cashNeeded: number
  resultPlanned: number
  resultForecast: number
  marginPlannedPct: number | null
  marginForecastPct: number | null
  executionPct: number | null
  costPerHa: number | null
  realizedCostPerHa: number | null
  breakEvenPrice: number | null
  breakEvenYield: number | null
  revenueQuantity: number | null
  revenueUnit: string | null
  area: number
}

export function totals(lines: BudgetLine[], actuals: ActualTx[], areaHa: number): Totals {
  let plannedExpense = 0, plannedRevenue = 0, plannedInvestment = 0, revQty = 0
  const revUnits = new Set<string>()
  for (const l of lines) {
    if (!active(l)) continue
    const v = n(l.total_amount)
    if (l.kind === 'receita') { plannedRevenue += v; revQty += n(l.quantity); if (l.unit) revUnits.add(l.unit) }
    else { plannedExpense += v; if (l.expense_type === 'investimento') plannedInvestment += v }
  }
  let realizedExpense = 0, paidExpense = 0, realizedRevenue = 0, payableOpen = 0
  for (const t of actuals) {
    if (t.status === 'cancelado') continue
    const v = n(t.amount)
    if (t.kind === 'receita') realizedRevenue += v
    else { realizedExpense += v; if (t.status === 'pago') paidExpense += v; else payableOpen += v }
  }
  // Por linha: o que ainda falta executar do orçado (linhas sem vínculo usam o status)
  let pendingExpense = 0
  for (const l of lines) {
    if (!active(l) || l.kind !== 'despesa') continue
    const linked = n(l.realized_amount)
    if (l.status === 'realizado' && linked === 0) continue
    pendingExpense += Math.max(n(l.total_amount) - linked, 0)
  }
  const forecastExpense = realizedExpense + pendingExpense
  const forecastRevenue = Math.max(plannedRevenue, realizedRevenue)
  const resultPlanned = plannedRevenue - plannedExpense
  const resultForecast = forecastRevenue - forecastExpense
  const singleUnit = revUnits.size === 1 ? [...revUnits][0] : null
  return {
    plannedExpense: round2(plannedExpense), plannedRevenue: round2(plannedRevenue), plannedInvestment: round2(plannedInvestment),
    realizedExpense: round2(realizedExpense), paidExpense: round2(paidExpense), realizedRevenue: round2(realizedRevenue),
    pendingExpense: round2(pendingExpense), payableOpen: round2(payableOpen), cashNeeded: round2(pendingExpense + payableOpen),
    resultPlanned: round2(resultPlanned), resultForecast: round2(resultForecast),
    marginPlannedPct: plannedRevenue > 0 ? (resultPlanned / plannedRevenue) * 100 : null,
    marginForecastPct: forecastRevenue > 0 ? (resultForecast / forecastRevenue) * 100 : null,
    executionPct: plannedExpense > 0 ? (realizedExpense / plannedExpense) * 100 : null,
    costPerHa: areaHa > 0 && plannedExpense > 0 ? plannedExpense / areaHa : null,
    realizedCostPerHa: areaHa > 0 && realizedExpense > 0 ? realizedExpense / areaHa : null,
    // ponto de equilíbrio só com receita em unidade única (ex.: sacas)
    breakEvenPrice: singleUnit && revQty > 0 && plannedExpense > 0 ? plannedExpense / revQty : null,
    breakEvenYield: singleUnit && revQty > 0 && plannedRevenue > 0 && areaHa > 0 ? (plannedExpense / (plannedRevenue / revQty)) / areaHa : null,
    revenueQuantity: singleUnit ? revQty : null, revenueUnit: singleUnit, area: areaHa,
  }
}

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------
export const SCENARIO_PRESETS: Record<'conservador' | 'realista' | 'otimista', Pick<Scenario, 'price_pct' | 'yield_pct' | 'cost_pct'>> = {
  conservador: { price_pct: -10, yield_pct: -10, cost_pct: 5 },
  realista: { price_pct: 0, yield_pct: 0, cost_pct: 0 },
  otimista: { price_pct: 10, yield_pct: 5, cost_pct: -3 },
}

/** Aplica um cenário ao orçamento base (receita = preço × produtividade; custos por categoria). */
export function applyScenario(lines: BudgetLine[], s: Scenario) {
  const price = 1 + n(s.price_pct) / 100, yieldF = 1 + n(s.yield_pct) / 100
  let revenue = 0, expense = 0
  for (const l of lines) {
    if (!active(l)) continue
    if (l.kind === 'receita') {
      revenue += n(l.quantity) * yieldF * n(l.unit_price) * price
    } else {
      const cat = n(s.category_pct?.[l.category_id])
      expense += n(l.total_amount) * Math.max(0, 1 + (n(s.cost_pct) + cat) / 100)
    }
  }
  expense += n(s.extra_investment)
  const result = revenue - expense
  return { name: s.name, revenue: round2(revenue), expense: round2(expense), result: round2(result), marginPct: revenue > 0 ? (result / revenue) * 100 : null }
}

// ---------------------------------------------------------------------------
// Apoio à decisão — sempre com a origem do número e sem inventar dados
// ---------------------------------------------------------------------------
export interface Insight {
  tone: 'bad' | 'warn' | 'good' | 'info'
  title: string
  detail: string
  /** de onde vem o número */
  source: string
}

export function insights(t: Totals, byCat: GroupRow[], lines: BudgetLine[], today: string, opts: { cash?: number | null; byCrop?: GroupRow[]; byActivity?: GroupRow[] } = {}): Insight[] {
  const out: Insight[] = []
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

  if (!lines.some((l) => l.kind === 'despesa' && active(l))) {
    out.push({ tone: 'info', title: 'Cadastre o orçamento de despesas', detail: 'Sem linhas de despesa no MICRO não é possível calcular custo por hectare, execução ou desvios.', source: 'MICRO → nenhuma linha de despesa no filtro atual' })
    return out
  }
  // estouros por categoria
  for (const c of byCat.filter((c) => c.planned > 0 && c.variance > 0).slice(0, 4)) {
    out.push({ tone: 'bad', title: `${c.label} acima do orçado`, detail: `Realizado ${brl(c.realized)} contra ${brl(c.planned)} orçados (${pct(c.variancePct ?? 0)} acima). Revise compras restantes desta categoria.`, source: 'Financeiro (lançamentos de despesa da categoria) × MICRO (linhas orçadas da categoria)' })
  }
  // gasto sem orçamento
  const unplanned = byCat.filter((c) => c.planned === 0 && c.realized > 0)
  if (unplanned.length) {
    out.push({ tone: 'warn', title: 'Despesas sem orçamento', detail: `${unplanned.map((c) => `${c.label} (${brl(c.realized)})`).join(', ')} foram realizadas sem previsão no MICRO.`, source: 'Financeiro: categorias com lançamentos e sem linha orçada' })
  }
  // concentração
  const top = byCat[0]
  if (top && top.sharePct >= 35) {
    out.push({ tone: 'info', title: `${top.label} concentra ${pct(top.sharePct)} do orçamento`, detail: `É a maior categoria (${brl(top.planned)}). Negociar preço ou volume aqui tem o maior impacto: 5% de redução economiza ${brl(top.planned * 0.05)}.`, source: 'MACRO → participação da categoria no orçado' })
  }
  if (opts.byCrop && opts.byCrop.filter((c) => c.planned > 0).length > 1) {
    const c = opts.byCrop[0]
    out.push({ tone: 'info', title: `Maior custo por cultura: ${c.label}`, detail: `${brl(c.planned)} orçados (${pct(c.sharePct)} do total).`, source: 'MACRO → agrupamento por cultura' })
  }
  if (opts.byActivity && opts.byActivity.some((a) => a.key && a.planned + a.realized > 0)) {
    const a = opts.byActivity.find((x) => x.key)!
    out.push({ tone: 'info', title: `Atividade de maior impacto: ${a.label}`, detail: `${brl(Math.max(a.planned, a.realized))} entre orçado e realizado.`, source: 'MICRO/Financeiro → linhas vinculadas a atividades do Diário de campo' })
  }
  // linhas vencidas não executadas
  const late = lines.filter((l) => l.kind === 'despesa' && (l.status === 'previsto' || l.status === 'aprovado') && l.planned_date < today && n(l.realized_amount) === 0)
  if (late.length) {
    out.push({ tone: 'warn', title: `${late.length} despesa(s) prevista(s) com data passada`, detail: `Somam ${brl(late.reduce((a, l) => a + n(l.total_amount), 0))}. Registre a realização no Financeiro ou reprograme a data.`, source: 'MICRO → linhas previstas/aprovadas com data prevista anterior a hoje' })
  }
  // caixa
  if (opts.cash !== undefined && opts.cash !== null && t.cashNeeded > 0) {
    if (t.cashNeeded > opts.cash) {
      out.push({ tone: 'bad', title: 'Desembolso previsto supera o saldo em caixa', detail: `Faltam ${brl(t.cashNeeded - opts.cash)}: a desembolsar ${brl(t.cashNeeded)} contra saldo atual de ${brl(opts.cash)}.`, source: 'Saldo das contas financeiras × (orçado não executado + contas a pagar em aberto)' })
    } else {
      out.push({ tone: 'good', title: 'Caixa cobre o desembolso previsto', detail: `Saldo de ${brl(opts.cash)} para ${brl(t.cashNeeded)} a desembolsar.`, source: 'Saldo das contas financeiras × valores a desembolsar' })
    }
  }
  // resultado
  if (t.plannedRevenue <= 0) {
    out.push({ tone: 'info', title: 'Informe a receita prevista', detail: 'Cadastre no MICRO uma linha de receita (ex.: produção esperada em sacas × preço) para calcular resultado, margem e ponto de equilíbrio.', source: 'MICRO → nenhuma linha de receita' })
  } else if (t.resultForecast < 0) {
    out.push({ tone: 'bad', title: 'Resultado previsto negativo', detail: `Receita prevista ${brl(Math.max(t.plannedRevenue, t.realizedRevenue))} não cobre custos previstos de ${brl(t.realizedExpense + t.pendingExpense)}.`, source: 'RESUMO → receita prevista − (realizado + orçado não executado)' })
  } else if (t.executionPct !== null) {
    out.push({ tone: t.executionPct > 100 ? 'warn' : 'good', title: t.executionPct > 100 ? 'Execução acima do orçamento total' : 'Orçamento dentro do planejado', detail: `Executado ${pct(t.executionPct)} do orçamento de despesas; margem prevista ${t.marginForecastPct !== null ? pct(t.marginForecastPct) : '—'}.`, source: 'Financeiro (despesas realizadas) ÷ MICRO (despesas orçadas)' })
  }
  if (t.area <= 0) {
    out.push({ tone: 'info', title: 'Área não informada', detail: 'Informe a área das propriedades/talhões ou a área plantada da safra para calcular custo por hectare e produtividade de equilíbrio.', source: 'Cadastro de propriedades, talhões e safras' })
  }
  return out
}
