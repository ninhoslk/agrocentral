import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/cn'
import { Card, CardHeader } from '@/components/ui/primitives'
import { EmptyState } from '@/components/feedback/states'
import { formatBRL, formatNumber, formatPct } from '@/lib/format'
import { groupBy, monthlySeries, type ActualTx, type BudgetLine, type Dimension, type GroupRow } from '@/lib/budget'
import { DIMENSIONS } from './config'

const kfmt = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumber(v / 1000, 0)} mil` : formatNumber(v, 0))
const monthLabel = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`

export function MacroView({ lines, actuals, dim, setDim, labelOf, areaOf }: {
  lines: BudgetLine[]
  actuals: ActualTx[]
  dim: Dimension
  setDim: (d: Dimension) => void
  labelOf: (dim: Dimension, key: string) => string
  /** área (ha) do grupo, quando a dimensão permite (talhão, safra, cultura, propriedade) */
  areaOf: (dim: Dimension, key: string) => number
}) {
  const rows = useMemo(() => groupBy(lines, actuals, dim, (k) => labelOf(dim, k)), [lines, actuals, dim, labelOf])
  const series = useMemo(() => monthlySeries(lines, actuals).map((m) => ({ ...m, label: monthLabel(m.month) })), [lines, actuals])
  const withArea = ['field', 'season', 'crop', 'farm'].includes(dim)
  const chart = rows.slice(0, 10).map((r) => ({ name: r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label, Orçado: r.planned, Realizado: r.realized }))
  const tp = rows.reduce((a, r) => a + r.planned, 0), tr = rows.reduce((a, r) => a + r.realized, 0)

  return (
    <div className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 scrollbar-thin">
        <div role="radiogroup" aria-label="Agrupar por" className="flex gap-2 pb-1">
          {DIMENSIONS.map((d) => (
            <button key={d.value} type="button" role="radio" aria-checked={dim === d.value} onClick={() => setDim(d.value)}
              className={cn('min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors sm:min-h-9',
                dim === d.value ? 'border-brand-700 bg-brand-800 text-white' : 'border-line bg-white text-ink hover:bg-surface')}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? <EmptyState title="Sem dados para consolidar" description="Cadastre linhas no MICRO ou lançamentos de despesa no Financeiro. O MACRO é atualizado automaticamente." /> : (
        <>
          <Card>
            <CardHeader title={`Despesas por ${DIMENSIONS.find((d) => d.value === dim)?.label.toLowerCase()}`}
              description="Orçado (MICRO) × realizado (Financeiro). Desvio positivo = gastou mais que o previsto." />
            {/* Celular: lista com barras; desktop: tabela completa */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => <MobileRow key={r.key} r={r} area={withArea ? areaOf(dim, r.key) : 0} />)}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface text-xs text-muted">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Grupo</th>
                    <th className="px-4 py-2 text-right font-medium">Orçado</th>
                    <th className="px-4 py-2 text-right font-medium">Realizado</th>
                    <th className="px-4 py-2 text-right font-medium">A executar</th>
                    <th className="px-4 py-2 text-right font-medium">Desvio</th>
                    <th className="px-4 py-2 text-right font-medium">% do total</th>
                    {withArea && <th className="px-4 py-2 text-right font-medium">Custo/ha (orçado)</th>}
                    <th className="w-40 px-4 py-2 font-medium">Execução</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const a = withArea ? areaOf(dim, r.key) : 0
                    return (
                      <tr key={r.key} className="border-t border-line">
                        <td className="px-4 py-2 font-medium">{r.label}</td>
                        <td className="px-4 py-2 text-right tabular">{formatBRL(r.planned)}</td>
                        <td className="px-4 py-2 text-right tabular">{formatBRL(r.realized)}</td>
                        <td className="px-4 py-2 text-right tabular text-muted">{formatBRL(r.pending)}</td>
                        <td className={cn('px-4 py-2 text-right tabular', r.variance > 0 ? 'text-danger' : r.variance < 0 ? 'text-ok' : '')}>
                          {r.planned > 0 ? <>{formatBRL(r.variance)} <span className="text-xs">({formatPct(r.variancePct)})</span></> : <span className="text-xs text-warn">sem orçamento</span>}
                        </td>
                        <td className="px-4 py-2 text-right tabular">{formatNumber(r.sharePct, 1)}%</td>
                        {withArea && <td className="px-4 py-2 text-right tabular">{a > 0 ? formatBRL(r.planned / a) : <span className="text-xs text-muted" title="Área não informada">—</span>}</td>}
                        <td className="px-4 py-2"><Bar2 planned={r.planned} realized={r.realized} /></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface font-semibold">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right tabular">{formatBRL(tp)}</td>
                    <td className="px-4 py-2 text-right tabular">{formatBRL(tr)}</td>
                    <td className="px-4 py-2 text-right tabular">{formatBRL(rows.reduce((a, r) => a + r.pending, 0))}</td>
                    <td className={cn('px-4 py-2 text-right tabular', tr > tp ? 'text-danger' : '')}>{formatBRL(tr - tp)}</td>
                    <td className="px-4 py-2 text-right">100%</td>
                    {withArea && <td />}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Orçado × realizado" description="Maiores grupos (até 10)" />
              <div className="h-[300px] p-2 sm:p-4">
                <ResponsiveContainer>
                  <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={kfmt} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatBRL(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Orçado" fill="#8bbf98" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Realizado" fill="#1b432c" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Evolução dos gastos" description="Barras: mês. Linhas: acumulado. Orçado distribuído pelas parcelas previstas." />
              <div className="h-[300px] p-2 sm:p-4">
                {series.length ? (
                  <ResponsiveContainer>
                    <ComposedChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={kfmt} width={56} />
                      <Tooltip formatter={(v) => formatBRL(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="orcado" name="Orçado no mês" fill="#b9d9c0" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="realizado" name="Realizado no mês" fill="#2a6840" radius={[3, 3, 0, 0]} />
                      <Line dataKey="orcadoAcum" name="Orçado acumulado" stroke="#8a6a43" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                      <Line dataKey="realizadoAcum" name="Realizado acumulado" stroke="#b42318" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="Sem datas para a série" />}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Bar2({ planned, realized }: { planned: number; realized: number }) {
  const pct = planned > 0 ? (realized / planned) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={cn('h-full rounded-full', pct > 100 ? 'bg-danger' : 'bg-brand-600')} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular text-muted">{planned > 0 ? `${formatNumber(pct, 0)}%` : '—'}</span>
    </div>
  )
}

function MobileRow({ r, area }: { r: GroupRow; area: number }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{r.label}</span>
        <span className="shrink-0 font-semibold tabular">{formatBRL(r.planned || r.realized)}</span>
      </div>
      <div className="mt-1.5"><Bar2 planned={r.planned} realized={r.realized} /></div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
        <span>Realizado {formatBRL(r.realized)}</span>
        {r.planned > 0 ? <span className={cn(r.variance > 0 && 'text-danger')}>Desvio {formatPct(r.variancePct)}</span> : <span className="text-warn">sem orçamento</span>}
        <span>{formatNumber(r.sharePct, 1)}% do total</span>
        {area > 0 && <span>{formatBRL(r.planned / area)}/ha</span>}
      </div>
    </li>
  )
}
