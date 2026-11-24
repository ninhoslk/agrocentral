/**
 * Calculadoras agrícolas: funções puras, com fórmula e unidades explícitas.
 * Resultados são apoio à decisão e não substituem recomendação técnica.
 */

const safeDiv = (a: number, b: number) => (b === 0 ? NaN : a / b)

/** Custo por hectare = custo total (R$) / área (ha) */
export function costPerHectare(totalCost: number, areaHa: number) {
  return safeDiv(totalCost, areaHa)
}

/** Produtividade (sc/ha) = produção (sc) / área (ha) */
export function productivity(production: number, areaHa: number) {
  return safeDiv(production, areaHa)
}

/** Custo por saca = custo total / produção (sc) */
export function costPerSack(totalCost: number, productionSacks: number) {
  return safeDiv(totalCost, productionSacks)
}

/** Ponto de equilíbrio: preço mínimo (R$/sc) = custo / produção; produção mínima (sc) = custo / preço */
export function breakEven(totalCost: number, production: number, price: number) {
  return { minPrice: safeDiv(totalCost, production), minProduction: safeDiv(totalCost, price) }
}

/** Lucro e rentabilidade */
export function profitability(revenue: number, cost: number) {
  const profit = revenue - cost
  return { profit, marginPct: safeDiv(profit, revenue) * 100, roiPct: safeDiv(profit, cost) * 100 }
}

/**
 * Sementes: população desejada (plantas/ha), germinação (%), emergência a campo (%),
 * espaçamento entre linhas (m), PMS (g/1000 sementes), área (ha).
 */
export function seeds(p: { population: number; germinationPct: number; emergencePct: number; rowSpacingM: number; tsw: number; areaHa: number }) {
  const viability = (p.germinationPct / 100) * (p.emergencePct / 100)
  const seedsPerHa = safeDiv(p.population, viability)
  const linearMetersPerHa = safeDiv(10000, p.rowSpacingM)
  const seedsPerMeter = safeDiv(seedsPerHa, linearMetersPerHa)
  const kgPerHa = (seedsPerHa * p.tsw) / 1000 / 1000
  return { seedsPerHa, seedsPerMeter, kgPerHa, totalKg: kgPerHa * p.areaHa }
}

/** Adubação: dose do nutriente (kg/ha) e concentração do produto (%) -> produto (kg/ha e total) */
export function fertilizer(p: { nutrientDoseKgHa: number; productConcentrationPct: number; areaHa: number; pricePerTon?: number }) {
  const productKgHa = safeDiv(p.nutrientDoseKgHa, p.productConcentrationPct / 100)
  const totalKg = productKgHa * p.areaHa
  return { productKgHa, totalKg, totalCost: p.pricePerTon ? (totalKg / 1000) * p.pricePerTon : undefined }
}

/** Pulverização: volume de calda (L/ha), capacidade do tanque (L), dose do produto (L ou kg/ha), área */
export function spraying(p: { sprayVolumeLHa: number; tankCapacityL: number; doseHa: number; areaHa: number }) {
  const areaPerTank = safeDiv(p.tankCapacityL, p.sprayVolumeLHa)
  const productPerTank = areaPerTank * p.doseHa
  const totalSpray = p.sprayVolumeLHa * p.areaHa
  return { areaPerTank, productPerTank, totalSpray, tanks: safeDiv(totalSpray, p.tankCapacityL), totalProduct: p.doseHa * p.areaHa }
}

/** Combustível: consumo (L/h), horas trabalhadas, preço (R$/L), rendimento (ha/h) opcional */
export function fuel(p: { consumptionLH: number; hours: number; pricePerL: number; haPerHour?: number }) {
  const liters = p.consumptionLH * p.hours
  const cost = liters * p.pricePerL
  const area = p.haPerHour ? p.haPerHour * p.hours : undefined
  return { liters, cost, litersPerHa: area ? liters / area : undefined, costPerHa: area ? cost / area : undefined }
}

/**
 * Irrigação (lâmina): ETc = ETo × Kc (mm/dia); lâmina bruta = ETc / eficiência.
 * 1 mm em 1 ha = 10 m³.
 */
export function irrigation(p: { etoMmDay: number; kc: number; efficiencyPct: number; areaHa: number; days: number }) {
  const etc = p.etoMmDay * p.kc
  const grossMmDay = safeDiv(etc, p.efficiencyPct / 100)
  const m3PerDay = grossMmDay * 10 * p.areaHa
  return { etc, grossMmDay, m3PerDay, m3Total: m3PerDay * p.days }
}

/** Financiamento — Tabela Price (parcelas fixas) e SAC (amortização constante). Taxa ao período (%). */
export function financing(p: { principal: number; ratePct: number; periods: number; system: 'price' | 'sac' }) {
  const i = p.ratePct / 100
  const rows: { n: number; payment: number; interest: number; amortization: number; balance: number }[] = []
  let balance = p.principal
  if (p.system === 'price') {
    const pmt = i === 0 ? p.principal / p.periods : (p.principal * i) / (1 - Math.pow(1 + i, -p.periods))
    for (let n = 1; n <= p.periods; n++) {
      const interest = balance * i
      const amortization = pmt - interest
      balance = Math.max(0, balance - amortization)
      rows.push({ n, payment: pmt, interest, amortization, balance })
    }
  } else {
    const amortization = p.principal / p.periods
    for (let n = 1; n <= p.periods; n++) {
      const interest = balance * i
      balance = Math.max(0, balance - amortization)
      rows.push({ n, payment: amortization + interest, interest, amortization, balance })
    }
  }
  const total = rows.reduce((s, r) => s + r.payment, 0)
  return { rows, total, totalInterest: total - p.principal }
}
