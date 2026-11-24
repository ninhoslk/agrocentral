/** Indicadores financeiros calculados a partir de lançamentos persistidos. */
export interface TxLike {
  kind: 'receita' | 'despesa' | string
  amount: number | string
  status: 'pendente' | 'pago' | 'cancelado' | string
  due_date: string
  paid_date?: string | null
  category_name?: string | null
}

export function summarize(txs: TxLike[], today: string) {
  let revenue = 0, expense = 0, paidRevenue = 0, paidExpense = 0, payable = 0, receivable = 0, overduePayable = 0, overdueReceivable = 0
  for (const t of txs) {
    if (t.status === 'cancelado') continue
    const v = Number(t.amount)
    if (t.kind === 'receita') {
      revenue += v
      if (t.status === 'pago') paidRevenue += v
      else { receivable += v; if (t.due_date < today) overdueReceivable += v }
    } else {
      expense += v
      if (t.status === 'pago') paidExpense += v
      else { payable += v; if (t.due_date < today) overduePayable += v }
    }
  }
  const result = revenue - expense
  return {
    revenue, expense, result,
    marginPct: revenue > 0 ? (result / revenue) * 100 : null,
    cashBalance: paidRevenue - paidExpense,
    payable, receivable, overduePayable, overdueReceivable,
  }
}

/** Fluxo de caixa mensal (previsto pelo vencimento; realizado pela data de pagamento). */
export function monthlyCashflow(txs: TxLike[]) {
  const map = new Map<string, { month: string; receitas: number; despesas: number; saldo: number }>()
  for (const t of txs) {
    if (t.status === 'cancelado') continue
    const date = t.status === 'pago' && t.paid_date ? t.paid_date : t.due_date
    const month = date.slice(0, 7)
    const row = map.get(month) ?? { month, receitas: 0, despesas: 0, saldo: 0 }
    if (t.kind === 'receita') row.receitas += Number(t.amount)
    else row.despesas += Number(t.amount)
    row.saldo = row.receitas - row.despesas
    map.set(month, row)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function byCategory(txs: TxLike[], kind: 'receita' | 'despesa') {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.status === 'cancelado' || t.kind !== kind) continue
    const k = t.category_name ?? 'Sem categoria'
    map.set(k, (map.get(k) ?? 0) + Number(t.amount))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

/** Divide um valor em N parcelas com centavos corretos (a última absorve a diferença). */
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  const parts = Array.from({ length: count }, () => base)
  parts[count - 1] += cents - base * count
  return parts.map((c) => c / 100)
}
