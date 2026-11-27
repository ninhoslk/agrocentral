import { useMemo, useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/cn'
import { supabase } from '@/services/supabase/client'
import { useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { Button, Card, CardHeader } from '@/components/ui/primitives'
import { useConfirm } from '@/components/ui/overlay'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { EmptyState } from '@/components/feedback/states'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatBRL, formatNumber, formatPct } from '@/lib/format'
import { applyScenario, SCENARIO_PRESETS, type BudgetLine, type GroupRow } from '@/lib/budget'
import type { ScenarioRow } from './useBudgetData'

const KIND_LABEL = { conservador: 'Conservador', realista: 'Realista', otimista: 'Otimista', personalizado: 'Personalizado' } as const

function Slider({ label, value, onChange, min = -50, max = 50 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm"><span>{label}</span><b className={cn('tabular', value > 0 ? 'text-ok' : value < 0 ? 'text-danger' : '')}>{value > 0 ? '+' : ''}{value}%</b></span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-8 w-full accent-brand-700" aria-label={label} />
    </label>
  )
}

export function ScenariosView({ lines, scenarios, byCat, seasonId }: { lines: BudgetLine[]; scenarios: ScenarioRow[]; byCat: GroupRow[]; seasonId: string }) {
  const { orgId, farmId, can } = useCurrentOrg()
  const lk = useLookups()
  const { confirm, node } = useConfirm()
  const [sim, setSim] = useState({ price_pct: 0, yield_pct: 0, cost_pct: 0, cat: '', cat_pct: 0, extra_investment: 0 })
  const [edit, setEdit] = useState<Partial<ScenarioRow> | null>(null)
  const inval = [['budget-scenarios']]
  const save = useAppMutation(async (v: Record<string, unknown>) => {
    const row = { ...v, category_pct: v.category_pct ?? {}, organization_id: orgId }
    const { error } = edit?.id ? await supabase.from('budget_scenarios').update(row as never).eq('id', edit.id) : await supabase.from('budget_scenarios').insert(row as never)
    if (error) throw error
  }, { invalidate: inval })
  const remove = useAppMutation(async (id: string) => { const { error } = await supabase.from('budget_scenarios').delete().eq('id', id); if (error) throw error }, { invalidate: inval, success: 'Cenário excluído' })

  const hasRevenue = lines.some((l) => l.kind === 'receita' && l.status !== 'cancelado')
  const relevant = scenarios.filter((s) => !seasonId || !s.season_id || s.season_id === seasonId)
  const simScenario = { name: 'Simulação', ...sim, category_pct: sim.cat ? { [sim.cat]: sim.cat_pct } : {} }
  const rows = useMemo(() => [
    { id: 'base', kind: 'base', ...applyScenario(lines, { name: 'Orçamento base', price_pct: 0, yield_pct: 0, cost_pct: 0 }) },
    ...relevant.map((s) => ({ id: s.id, kind: s.kind, s, ...applyScenario(lines, s) })),
    { id: 'sim', kind: 'sim', ...applyScenario(lines, simScenario) },
  ], [lines, relevant, simScenario]) // eslint-disable-line react-hooks/exhaustive-deps
  const base = rows[0]

  if (!lines.some((l) => l.status !== 'cancelado')) return <EmptyState title="Sem orçamento para simular" description="Cadastre despesas e a receita prevista no MICRO. Os cenários ajustam esses valores sem duplicá-los." />

  return (
    <div className="space-y-5">
      {!hasRevenue && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Sem receita prevista, os cenários mostram apenas o efeito nos custos. Cadastre a produção esperada × preço no MICRO (aba Receitas).</p>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="Simulador rápido" description="Ajuste e veja o resultado na hora. Salve como cenário para comparar depois." />
          <div className="space-y-4 p-4">
            <Slider label="Preço de venda" value={sim.price_pct} onChange={(v) => setSim({ ...sim, price_pct: v })} />
            <Slider label="Produtividade" value={sim.yield_pct} onChange={(v) => setSim({ ...sim, yield_pct: v })} />
            <Slider label="Custos (todas as categorias)" value={sim.cost_pct} onChange={(v) => setSim({ ...sim, cost_pct: v })} />
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <label className="block text-sm">Redução/aumento em uma categoria
                <select value={sim.cat} onChange={(e) => setSim({ ...sim, cat: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-line bg-white px-3 text-base sm:h-10 sm:text-sm">
                  <option value="">—</option>
                  {byCat.filter((c) => c.planned > 0).map((c) => <option key={c.key} value={c.key}>{c.label} ({formatBRL(c.planned)})</option>)}
                </select>
              </label>
              <input type="number" aria-label="Percentual da categoria" disabled={!sim.cat} value={sim.cat_pct} min={-100} max={200} onChange={(e) => setSim({ ...sim, cat_pct: Number(e.target.value) })}
                className="h-11 w-20 rounded-lg border border-line px-2 text-right sm:h-10" />
            </div>
            <label className="block text-sm">Novo investimento (R$)
              <input type="number" min={0} step={1000} value={sim.extra_investment || ''} onChange={(e) => setSim({ ...sim, extra_investment: Math.max(0, Number(e.target.value)) })}
                placeholder="Ex.: 250000" className="mt-1 h-11 w-full rounded-lg border border-line px-3 text-base sm:h-10 sm:text-sm" />
            </label>
            <div className="rounded-xl bg-surface p-3 text-sm">
              <div className="flex justify-between"><span>Resultado simulado</span><b className={cn('tabular', rows.at(-1)!.result < 0 ? 'text-danger' : 'text-ok')}>{formatBRL(rows.at(-1)!.result)}</b></div>
              <div className="flex justify-between text-xs text-muted"><span>Diferença para o base</span><span className="tabular">{formatBRL(rows.at(-1)!.result - base.result)}</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSim({ price_pct: 0, yield_pct: 0, cost_pct: 0, cat: '', cat_pct: 0, extra_investment: 0 })}>Zerar</Button>
              {can('budget', 'create') && <Button size="sm" onClick={() => setEdit({ kind: 'personalizado', name: '', price_pct: sim.price_pct, yield_pct: sim.yield_pct, cost_pct: sim.cost_pct, extra_investment: sim.extra_investment, category_pct: sim.cat ? { [sim.cat]: sim.cat_pct } : {}, season_id: seasonId || null })}><Save className="h-4 w-4" />Salvar como cenário</Button>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Comparação de cenários" actions={can('budget', 'create') && (
            <div className="flex flex-wrap gap-1">
              {(['conservador', 'realista', 'otimista'] as const).filter((k) => !relevant.some((s) => s.kind === k)).map((k) => (
                <Button key={k} size="sm" variant="outline" onClick={() => setEdit({ kind: k, name: KIND_LABEL[k], ...SCENARIO_PRESETS[k], season_id: seasonId || null })}><Plus className="h-4 w-4" />{KIND_LABEL[k]}</Button>
              ))}
            </div>
          )} />
          <div className="h-56 p-2 sm:p-4">
            <ResponsiveContainer>
              <BarChart data={rows.map((r) => ({ name: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name, Receita: r.revenue, Custos: r.expense, Resultado: r.result }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${formatNumber(Number(v) / 1000, 0)} mil`} width={60} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receita" fill="#5b9f6d" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Custos" fill="#d9b44a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Resultado" fill="#1b432c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="text-xs text-muted">
                    {'s' in r && r.s ? `Preço ${formatPct(Number(r.s.price_pct), 0)} · Produt. ${formatPct(Number(r.s.yield_pct), 0)} · Custos ${formatPct(Number(r.s.cost_pct), 0)}${Number(r.s.extra_investment) ? ` · +${formatBRL(r.s.extra_investment)} invest.` : ''}` : r.id === 'base' ? 'Valores do MICRO sem ajustes' : 'Ajustes do simulador'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('font-semibold tabular', r.result < 0 ? 'text-danger' : 'text-ok')}>{formatBRL(r.result)}</div>
                  <div className="text-xs text-muted tabular">{r.marginPct !== null ? `margem ${formatPct(r.marginPct)}` : '—'}{r.id !== 'base' ? ` · ${r.result - base.result >= 0 ? '+' : ''}${formatBRL(r.result - base.result)}` : ''}</div>
                </div>
                {'s' in r && r.s && (
                  <div className="flex">
                    {can('budget', 'edit') && <Button variant="ghost" size="icon" aria-label={`Editar ${r.name}`} onClick={() => setEdit(r.s!)}><Pencil className="h-4 w-4" /></Button>}
                    {can('budget', 'delete') && <Button variant="ghost" size="icon" aria-label={`Excluir ${r.name}`} onClick={async () => { if (await confirm('Excluir cenário?', 'O orçamento base não é alterado.', 'Excluir')) remove.mutate(r.s!.id) }}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ResourceFormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="md" title={edit?.id ? 'Editar cenário' : 'Novo cenário'}
        description="Percentuais aplicados sobre o orçamento base (MICRO). Ex.: preço −10% simula queda de preço de venda."
        initial={edit} defaults={{ farm_id: farmId }}
        fields={[
          { name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 80, span: 2 },
          { name: 'kind', label: 'Tipo', type: 'select', required: true, options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })), span: 1 },
          { name: 'price_pct', label: 'Preço de venda', type: 'number', required: true, min: -100, max: 500, suffix: '%', span: 1 },
          { name: 'yield_pct', label: 'Produtividade', type: 'number', required: true, min: -100, max: 500, suffix: '%', span: 1 },
          { name: 'cost_pct', label: 'Custos', type: 'number', required: true, min: -100, max: 500, suffix: '%', span: 1 },
          { name: 'extra_investment', label: 'Investimento adicional', type: 'money', min: 0, span: 1 },
          { name: 'season_id', label: 'Safra', type: 'select', options: toOptions((lk.seasons.data ?? []).filter((s) => !farmId || s.farm_id === farmId), (s) => s.name), span: 2, emptyOption: 'Todas' },
          { name: 'notes', label: 'Premissas / observações', type: 'textarea', maxLength: 2000, span: 3 },
        ]}
        onSubmit={async (v) => { await save.mutateAsync({ ...v, farm_id: edit?.id ? edit.farm_id : farmId, extra_investment: v.extra_investment ?? 0, category_pct: edit?.category_pct ?? {} }) }} />
      {node}
    </div>
  )
}
