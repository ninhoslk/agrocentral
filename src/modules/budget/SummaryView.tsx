import { AlertTriangle, CheckCircle2, Info, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { StatCard } from '@/components/ui/layout'
import { Card, CardHeader } from '@/components/ui/primitives'
import { formatBRL, formatNumber, formatPct } from '@/lib/format'
import type { BudgetLine, GroupRow, Insight, Totals } from '@/lib/budget'

const ICON = { bad: AlertTriangle, warn: TrendingDown, good: CheckCircle2, info: Info }
const TONE = { bad: 'border-red-200 bg-red-50/60', warn: 'border-amber-200 bg-amber-50/60', good: 'border-green-200 bg-green-50/60', info: 'border-line bg-white' }
const ICON_TONE = { bad: 'text-danger', warn: 'text-warn', good: 'text-ok', info: 'text-info' }

export function SummaryView({ t, byCat, byCrop, byActivity, lines, insights, today, financeAccess }: {
  t: Totals; byCat: GroupRow[]; byCrop: GroupRow[]; byActivity: GroupRow[]; lines: BudgetLine[]; insights: Insight[]; today: string; financeAccess: boolean
}) {
  const over = byCat.filter((c) => c.planned > 0 && c.variance > 0)
  const upcoming = lines.filter((l) => l.kind === 'despesa' && (l.status === 'previsto' || l.status === 'aprovado') && l.planned_date >= today)
  const upcomingSum = upcoming.reduce((a, l) => a + Number(l.total_amount) - Number(l.realized_amount ?? 0), 0)
  const exec = t.executionPct
  const na = (why: string) => <span className="text-sm font-normal text-muted">{why}</span>

  const qa: { q: string; a: React.ReactNode }[] = [
    { q: 'Onde está sendo gasto mais dinheiro?', a: byCat[0] ? <><b>{byCat[0].label}</b>: {formatBRL(byCat[0].planned || byCat[0].realized)} ({formatNumber(byCat[0].sharePct, 0)}% do total)</> : 'Sem dados.' },
    { q: 'Quais categorias representam os maiores custos?', a: byCat.length ? byCat.slice(0, 3).map((c) => `${c.label} (${formatNumber(c.sharePct, 0)}%)`).join(' · ') : 'Sem dados.' },
    { q: 'Quais despesas ultrapassaram o orçamento?', a: !financeAccess ? 'Requer acesso ao Financeiro (realizado).' : over.length ? over.map((c) => `${c.label} (+${formatBRL(c.variance)})`).join(' · ') : 'Nenhuma categoria acima do orçado.' },
    { q: 'Quais despesas ainda estão previstas?', a: upcoming.length ? `${upcoming.length} linha(s), somando ${formatBRL(upcomingSum)}.` : 'Nenhuma despesa futura prevista.' },
    { q: 'Qual cultura apresenta maior custo?', a: byCrop.find((c) => c.key) ? <><b>{byCrop.find((c) => c.key)!.label}</b>: {formatBRL(byCrop.find((c) => c.key)!.planned)}</> : 'Vincule as linhas a safras ou culturas.' },
    { q: 'Qual atividade apresenta maior impacto financeiro?', a: byActivity.find((c) => c.key) ? <><b>{byActivity.find((c) => c.key)!.label}</b>: {formatBRL(Math.max(byActivity.find((c) => c.key)!.planned, byActivity.find((c) => c.key)!.realized))}</> : 'Vincule linhas ou lançamentos a atividades do Diário de campo.' },
    { q: 'Quanto ainda será necessário desembolsar?', a: <><b>{formatBRL(t.cashNeeded)}</b> = orçado não executado {formatBRL(t.pendingExpense)} + contas a pagar em aberto {formatBRL(t.payableOpen)}</> },
    { q: 'Qual é a previsão de resultado da safra?', a: t.plannedRevenue > 0 ? <><b className={t.resultForecast < 0 ? 'text-danger' : 'text-ok'}>{formatBRL(t.resultForecast)}</b> (margem {formatPct(t.marginForecastPct)})</> : 'Cadastre a receita prevista no MICRO.' },
    { q: 'O orçamento atual está dentro do planejado?', a: exec === null ? 'Sem orçamento de despesas.' : exec > 100 ? <span className="text-danger">Não: {formatNumber(exec, 0)}% executado.</span> : <span className="text-ok">Sim: {formatNumber(exec, 0)}% executado, {over.length ? `${over.length} categoria(s) estouraram` : 'sem estouros por categoria'}.</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orçamento de despesas" value={formatBRL(t.plannedExpense)} hint={t.plannedInvestment ? `Inclui ${formatBRL(t.plannedInvestment)} em investimentos` : 'Custeio + demais'} />
        <StatCard label="Despesas realizadas" value={financeAccess ? formatBRL(t.realizedExpense) : '—'} tone={exec !== null && exec > 100 ? 'bad' : 'default'} hint={exec !== null ? `${formatNumber(exec, 0)}% do orçado · pago ${formatBRL(t.paidExpense)}` : undefined} />
        <StatCard label="A desembolsar" value={formatBRL(t.cashNeeded)} tone="warn" hint="Orçado não executado + contas em aberto" />
        <StatCard label="Investimentos" value={formatBRL(t.plannedInvestment)} hint="Linhas do tipo investimento" />
        <StatCard label="Receita prevista" value={t.plannedRevenue ? formatBRL(t.plannedRevenue) : na('Não informada')} hint={t.revenueQuantity ? `${formatNumber(t.revenueQuantity, 0)} ${t.revenueUnit}` : undefined} />
        <StatCard label="Receita realizada" value={financeAccess ? formatBRL(t.realizedRevenue) : '—'} tone="good" />
        <StatCard label="Resultado estimado" value={t.plannedRevenue ? formatBRL(t.resultForecast) : na('Falta receita')} tone={t.resultForecast >= 0 ? 'good' : 'bad'}
          hint={t.plannedRevenue ? `Orçado: ${formatBRL(t.resultPlanned)}` : undefined} />
        <StatCard label="Margem operacional" value={t.marginForecastPct !== null ? formatPct(t.marginForecastPct) : na('Falta receita')} tone={t.marginForecastPct !== null && t.marginForecastPct < 0 ? 'bad' : 'default'}
          hint={t.marginPlannedPct !== null ? `Planejada ${formatPct(t.marginPlannedPct)}` : undefined} />
        <StatCard label="Custo por hectare" value={t.costPerHa !== null ? formatBRL(t.costPerHa) : na('Informe a área')} hint={t.area ? `Área: ${formatNumber(t.area)} ha${t.realizedCostPerHa ? ` · realizado ${formatBRL(t.realizedCostPerHa)}/ha` : ''}` : undefined} />
        <StatCard label="Ponto de equilíbrio" value={t.breakEvenPrice !== null ? `${formatBRL(t.breakEvenPrice)}/${t.revenueUnit}` : na('Receita em 1 unidade')}
          hint={t.breakEvenYield !== null ? `ou ${formatNumber(t.breakEvenYield, 1)} ${t.revenueUnit}/ha ao preço previsto` : 'Preço mínimo que cobre o orçamento'} className="col-span-2 lg:col-span-2" />
      </div>

      {exec !== null && (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between text-sm"><span className="font-medium">Execução do orçamento</span><span className="tabular text-muted">{formatBRL(t.realizedExpense)} de {formatBRL(t.plannedExpense)}</span></div>
          <div className="relative h-3 overflow-hidden rounded-full bg-black/[0.06]">
            <div className={cn('h-full rounded-full', exec > 100 ? 'bg-danger' : 'bg-brand-600')} style={{ width: `${Math.min(exec, 100)}%` }} />
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Análises e recomendações" description="Geradas apenas a partir dos dados cadastrados — cada item mostra de onde vem o número." />
          <ul className="space-y-2 p-3 sm:p-4">
            {insights.map((i, k) => {
              const Ico = ICON[i.tone]
              return (
                <li key={k} className={cn('rounded-xl border p-3', TONE[i.tone])}>
                  <div className="flex gap-2.5">
                    <Ico className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_TONE[i.tone])} aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{i.title}</p>
                      <p className="mt-0.5 text-sm text-ink/80">{i.detail}</p>
                      <p className="mt-1 text-[11px] text-muted">Fonte: {i.source}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Perguntas-chave" />
          <dl className="divide-y divide-line">
            {qa.map((x) => (
              <div key={x.q} className="px-4 py-3">
                <dt className="text-xs font-medium text-muted">{x.q}</dt>
                <dd className="mt-0.5 text-sm">{x.a}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}
