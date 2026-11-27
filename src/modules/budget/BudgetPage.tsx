import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, FileSpreadsheet, FileText, Gauge, Layers, ListTree, Plus, Receipt, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { FilterPanel } from '@/components/ui/FilterPanel'
import { Button, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/overlay'
import { ErrorState, LoadingRows } from '@/components/feedback/states'
import { useLookups, byId } from '@/hooks/useLookups'
import { formatBRL, formatDate, formatNumber, toISODate } from '@/lib/format'
import { groupBy, insights as buildInsights, totals as buildTotals, type Dimension } from '@/lib/budget'
import { exportPDFSections, exportWorkbook } from '@/utils/export'
import { BudgetLineDialog } from './BudgetLineDialog'
import { DIMENSIONS, EXPENSE_TYPES, STATUS } from './config'
import { RealizeDialog } from './RealizeDialog'
import { MicroView } from './MicroView'
import { MacroView } from './MacroView'
import { SummaryView } from './SummaryView'
import { ScenariosView } from './ScenariosView'
import { BUDGET_KEYS, EMPTY_FILTERS, useBudgetData, type BudgetFilters, type LineRow } from './useBudgetData'

type View = 'micro' | 'macro' | 'resumo' | 'cenarios'
const VIEWS: { value: View; label: string; hint: string; icon: typeof ListTree }[] = [
  { value: 'micro', label: 'MICRO', hint: 'Detalhar', icon: ListTree },
  { value: 'macro', label: 'MACRO', hint: 'Consolidar', icon: Layers },
  { value: 'resumo', label: 'RESUMO', hint: 'Decidir', icon: Gauge },
  { value: 'cenarios', label: 'Cenários', hint: 'Simular', icon: Sparkles },
]

export function BudgetPage() {
  const { farms, farmId, can } = useCurrentOrg()
  const lk = useLookups()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.some((v) => v.value === params.get('aba')) ? params.get('aba') : 'resumo') as View
  const setView = (v: View) => { params.set('aba', v); setParams(params, { replace: true }) }
  const [f, setF] = useState<BudgetFilters>(() => ({ ...EMPTY_FILTERS, season: params.get('safra') ?? '' }))
  const [kind, setKind] = useState<'despesa' | 'receita'>('despesa')
  const [dim, setDim] = useState<Dimension>('category')
  const [edit, setEdit] = useState<(Partial<LineRow> & { kind?: string }) | null>(null)
  const [realize, setRealize] = useState<LineRow | null>(null)
  const today = toISODate()

  useEffect(() => {
    const n = params.get('novo')
    if (n === 'despesa' || n === 'receita') { setEdit({ kind: n, season_id: f.season || null }); setKind(n); params.delete('novo'); setParams(params, { replace: true }) }
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const d = useBudgetData(f)
  const refresh = () => BUDGET_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }))

  // Rótulos de cada dimensão a partir dos cadastros existentes (sem duplicar dados)
  const maps = useMemo(() => ({
    season: byId(lk.seasons.data), field: byId(lk.fields.data), crop: byId(lk.crops.data), farm: byId(farms),
    cat: byId(lk.categories.data), act: new Map(d.activities.map((a) => [a.id, a])),
  }), [lk.seasons.data, lk.fields.data, lk.crops.data, lk.categories.data, farms, d.activities])
  const labelOf = useCallback((dimension: Dimension, key: string) => {
    if (!key) return { season: 'Sem safra', field: 'Sem talhão', crop: 'Sem cultura', farm: 'Sem propriedade', activity: 'Sem atividade', category: 'Sem categoria' }[dimension as string] ?? '—'
    switch (dimension) {
      case 'category': return maps.cat.get(key)?.name ?? 'Categoria'
      case 'season': return maps.season.get(key)?.name ?? 'Safra'
      case 'field': return maps.field.get(key)?.name ?? 'Talhão'
      case 'crop': return maps.crop.get(key)?.name ?? 'Cultura'
      case 'farm': return maps.farm.get(key)?.name ?? 'Propriedade'
      case 'activity': { const a = maps.act.get(key); return a ? `${a.activity_types?.name ?? 'Atividade'}${a.title ? ` — ${a.title}` : ''}` : 'Atividade' }
      case 'expense_type': return EXPENSE_TYPES.find((x) => x.value === key)?.label ?? key
      case 'month': return `${key.slice(5)}/${key.slice(0, 4)}`
      default: return key
    }
  }, [maps])
  const areaOf = useCallback((dimension: Dimension, key: string) => {
    if (!key) return 0
    if (dimension === 'field') return d.fieldArea(key)
    if (dimension === 'season') return d.seasonArea(key)
    if (dimension === 'crop') return d.cropArea(key)
    if (dimension === 'farm') return d.farmArea(key)
    return 0
  }, [d])

  const t = useMemo(() => buildTotals(d.lines, d.actuals, d.area), [d.lines, d.actuals, d.area])
  const byCat = useMemo(() => groupBy(d.lines, d.actuals, 'category', (k) => labelOf('category', k)), [d.lines, d.actuals, labelOf])
  const byCrop = useMemo(() => groupBy(d.lines, d.actuals, 'crop', (k) => labelOf('crop', k)), [d.lines, d.actuals, labelOf])
  const byActivity = useMemo(() => groupBy(d.lines, d.actuals, 'activity', (k) => labelOf('activity', k)), [d.lines, d.actuals, labelOf])
  const ins = useMemo(() => buildInsights(t, byCat, d.lines, today, { cash: d.cash, byCrop, byActivity }), [t, byCat, d.lines, today, d.cash, byCrop, byActivity])

  const activeFilters = [
    f.season && labelOf('season', f.season), f.crop && labelOf('crop', f.crop), f.field && labelOf('field', f.field), f.category && labelOf('category', f.category),
    (f.from || f.to) && `${f.from ? formatDate(f.from) : '…'} a ${f.to ? formatDate(f.to) : '…'}`,
  ].filter(Boolean) as string[]

  const doExport = async (fmt: 'xlsx' | 'pdf') => {
    const micro = d.lines.map((l) => ({
      Tipo: l.kind === 'receita' ? 'Receita' : 'Despesa', Categoria: l.category_name, Subcategoria: l.subcategory ?? '', Descrição: l.description,
      Propriedade: labelOf('farm', l.farm_id ?? ''), Safra: l.season_id ? labelOf('season', l.season_id) : '', Talhão: l.field_id ? labelOf('field', l.field_id) : '',
      'Data prevista': formatDate(l.planned_date), Quantidade: Number(l.quantity), Unidade: l.unit ?? '', 'Valor unitário': Number(l.unit_price),
      'Total orçado': Number(l.total_amount), Realizado: Number(l.realized_amount ?? 0), Status: STATUS[l.status as keyof typeof STATUS]?.label ?? l.status,
    }))
    const macro = (dims: Dimension[]) => dims.flatMap((dm) => groupBy(d.lines, d.actuals, dm, (k) => labelOf(dm, k)).map((r) => ({
      Agrupamento: DIMENSIONS.find((x) => x.value === dm)?.label ?? dm, Grupo: r.label, Orçado: r.planned, Realizado: r.realized, 'A executar': r.pending,
      Desvio: r.variance, 'Desvio %': r.variancePct === null ? '' : Number(r.variancePct.toFixed(1)), '% do total': Number(r.sharePct.toFixed(1)),
    })))
    const resumo = [
      ['Orçamento de despesas', t.plannedExpense], ['Investimentos planejados', t.plannedInvestment], ['Despesas realizadas', t.realizedExpense],
      ['A desembolsar', t.cashNeeded], ['Receita prevista', t.plannedRevenue], ['Receita realizada', t.realizedRevenue], ['Resultado estimado', t.resultForecast],
      ['Margem operacional (%)', t.marginForecastPct === null ? 'sem receita' : Number(t.marginForecastPct.toFixed(1))],
      ['Custo por hectare', t.costPerHa === null ? 'sem área' : Number(t.costPerHa.toFixed(2))], ['Área considerada (ha)', t.area],
      ['Ponto de equilíbrio (preço)', t.breakEvenPrice === null ? 'dados insuficientes' : `${formatBRL(t.breakEvenPrice)}/${t.revenueUnit}`],
    ].map(([Indicador, Valor]) => ({ Indicador: Indicador as string, Valor: Valor as string | number }))
    const recs = ins.map((i) => ({ Análise: i.title, Detalhe: i.detail, Fonte: i.source }))
    const sub = `Gerado em ${new Date().toLocaleString('pt-BR')}${farmId ? ` · ${labelOf('farm', farmId)}` : ' · Todas as propriedades'}${activeFilters.length ? ` · ${activeFilters.join(' · ')}` : ''}`
    if (!micro.length && !d.actuals.length) { toast.info('Nada para exportar no filtro atual'); return }
    if (fmt === 'xlsx') await exportWorkbook('Orçamento rural', [{ name: 'RESUMO', rows: resumo }, { name: 'Recomendações', rows: recs }, { name: 'MACRO', rows: macro(['category', 'season', 'crop', 'field', 'expense_type', 'month']) }, { name: 'MICRO', rows: micro }])
    else await exportPDFSections('Orçamento rural', [{ title: 'RESUMO', rows: resumo }, { title: 'Análises', rows: recs }, { title: 'MACRO por categoria', rows: macro(['category']) }, { title: 'MICRO — linhas', rows: micro.map(({ Propriedade: _p, Unidade: _u, ...r }) => r) }], sub)
  }

  const canCreate = can('budget', 'create')
  return (
    <>
      <PageHeader title="Orçamento" crumbs={[{ label: 'Gestão' }, { label: 'Orçamento' }]}
        description="Planeje (MICRO), consolide (MACRO) e decida (RESUMO). O realizado vem do Financeiro — nada é digitado duas vezes."
        actions={<>
          {can('budget', 'export') && <Dropdown trigger={<Button variant="outline" aria-label="Exportar"><FileText className="h-4 w-4" /><span className="max-sm:hidden">Exportar</span></Button>}
            items={[{ label: 'Excel (MICRO, MACRO, RESUMO)', icon: <FileSpreadsheet className="h-4 w-4" />, onSelect: () => void doExport('xlsx') }, { label: 'PDF executivo', icon: <FileText className="h-4 w-4" />, onSelect: () => void doExport('pdf') }]} />}
          {canCreate && <Button variant="outline" onClick={() => { setKind('receita'); setEdit({ kind: 'receita', season_id: f.season || null }) }}><Plus className="h-4 w-4" />Receita</Button>}
          {canCreate && <Button onClick={() => { setKind('despesa'); setEdit({ kind: 'despesa', season_id: f.season || null }) }}><Receipt className="h-4 w-4" />Despesa</Button>}
        </>} />

      {/* Navegação MICRO → MACRO → RESUMO: segmentos grandes e fixos no topo no celular */}
      <nav aria-label="Níveis do orçamento" className="sticky top-14 z-[400] -mx-4 mb-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div role="tablist" className="grid grid-cols-4 gap-1 rounded-xl bg-black/[0.05] p-1">
          {VIEWS.map((v, i) => (
            <button key={v.value} role="tab" type="button" aria-selected={view === v.value} onClick={() => setView(v.value)}
              className={cn('flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-center transition-colors [-webkit-tap-highlight-color:transparent] sm:flex-row sm:gap-2',
                view === v.value ? 'bg-white text-brand-900 shadow-sm' : 'text-muted hover:text-ink')}>
              <v.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[12px] font-semibold leading-tight sm:text-sm">{i < 3 ? `${i + 1}. ` : ''}{v.label}</span>
              <span className="hidden text-xs font-normal text-muted lg:inline">· {v.hint}</span>
            </button>
          ))}
        </div>
      </nav>

      <FilterPanel gridClassName="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end" summary={activeFilters.join(' · ') || 'Tudo'}>
        <FieldWrap label="Safra" htmlFor="b-season" className="col-span-2 sm:min-w-48">
          <Select id="b-season" value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}><option value="">Todas</option>{(lk.seasons.data ?? []).filter((s) => !farmId || s.farm_id === farmId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </FieldWrap>
        <FieldWrap label="Cultura" htmlFor="b-crop"><Select id="b-crop" value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })}><option value="">Todas</option>{lk.crops.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FieldWrap>
        <FieldWrap label="Talhão" htmlFor="b-field"><Select id="b-field" value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })}><option value="">Todos</option>{(lk.fields.data ?? []).filter((x) => !farmId || x.farm_id === farmId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></FieldWrap>
        <FieldWrap label="Categoria" htmlFor="b-cat" className="col-span-2 sm:col-span-1"><Select id="b-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Todas</option>{lk.categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FieldWrap>
        <FieldWrap label="De" htmlFor="b-from"><Input id="b-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></FieldWrap>
        <FieldWrap label="Até" htmlFor="b-to"><Input id="b-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></FieldWrap>
        {activeFilters.length > 0 && <Button variant="ghost" size="sm" className="col-span-2" onClick={() => setF(EMPTY_FILTERS)}><X className="h-4 w-4" />Limpar filtros</Button>}
      </FilterPanel>

      {/* Faixa de totais sempre visível: o produtor sabe onde está em qualquer nível */}
      {!d.loading && !d.error && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center sm:gap-3">
          {[{ l: 'Orçado', v: t.plannedExpense, c: '' }, { l: 'Realizado', v: t.realizedExpense, c: t.executionPct !== null && t.executionPct > 100 ? 'text-danger' : '' }, { l: 'A desembolsar', v: t.cashNeeded, c: 'text-warn' }].map((x) => (
            <div key={x.l} className="card px-2 py-2.5 sm:px-4 sm:py-3">
              <div className="text-[11px] font-medium text-muted sm:text-xs">{x.l}</div>
              <div className={cn('truncate text-[15px] font-semibold tabular sm:text-xl', x.c)}>{formatBRL(x.v)}</div>
            </div>
          ))}
        </div>
      )}
      {!d.financeAccess && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Seu papel não tem acesso ao Financeiro: os valores realizados não são exibidos.</p>}

      {d.error ? <ErrorState error={d.error} onRetry={d.refetch} /> : d.loading ? <LoadingRows rows={6} /> : (
        <>
          {view === 'micro' && <MicroView lines={d.lines as LineRow[]} kind={kind} setKind={setKind} financeAccess={d.financeAccess}
            onEdit={(l) => setEdit(l)} onRealize={setRealize}
            onDuplicate={(l) => { const { id: _id, ...copy } = l; setEdit({ ...copy, status: 'previsto', actual_date: null, description: `${l.description} (cópia)` }) }}
            names={{ season: (id) => (id ? labelOf('season', id) : '—'), field: (id) => (id ? labelOf('field', id) : '') }} />}
          {view === 'macro' && <MacroView lines={d.lines} actuals={d.actuals} dim={dim} setDim={setDim} labelOf={labelOf} areaOf={areaOf} />}
          {view === 'resumo' && <SummaryView t={t} byCat={byCat} byCrop={byCrop} byActivity={byActivity} lines={d.lines} insights={ins} today={today} financeAccess={d.financeAccess} />}
          {view === 'cenarios' && <ScenariosView lines={d.lines} scenarios={d.scenarios} byCat={byCat} seasonId={f.season} />}
        </>
      )}

      {view !== 'micro' && !d.loading && d.lines.length > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><BarChart3 className="h-3.5 w-3.5" aria-hidden />{formatNumber(d.lines.length, 0)} linhas orçadas e {formatNumber(d.actuals.length, 0)} lançamentos do Financeiro no filtro.</p>
      )}

      <BudgetLineDialog edit={edit} onClose={() => setEdit(null)} onSaved={refresh} activities={d.activities as never} />
      <RealizeDialog line={realize} onClose={() => setRealize(null)} onSaved={refresh} />
    </>
  )
}
