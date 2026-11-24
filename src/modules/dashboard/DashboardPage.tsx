import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Banknote, Bell, CloudSun, GripVertical, LayoutDashboard, LineChart, ListChecks, Maximize2, Minimize2, Plus, Sprout, Store, Tractor, Wheat, X } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Skeleton } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/overlay'
import { DataStateBadge, DemoBadge, SourceLine } from '@/components/feedback/states'
import { cn } from '@/lib/cn'
import { WeatherIcon } from '@/components/feedback/WeatherIcon'
import { formatArea, formatBRL, formatDate, formatNumber, formatPct, relativeTime, toISODate } from '@/lib/format'
import { summarize } from '@/lib/finance'
import { useWeather } from '@/hooks/useWeather'
import { useMarketData, seriesOf } from '@/hooks/useMarket'
import { quoteState, variation } from '@/services/providers/market'
import { weatherLabel, type WeatherResponse } from '@/services/providers/weather'

type Size = 'sm' | 'md' | 'lg'
interface WidgetCfg { id: string; size: Size }

const CATALOG: { id: string; title: string; icon: ReactNode; module?: string; defaultSize: Size }[] = [
  { id: 'resumo', title: 'Resumo da fazenda', icon: <LayoutDashboard className="h-4 w-4" />, module: 'farms', defaultSize: 'md' },
  { id: 'clima', title: 'Clima', icon: <CloudSun className="h-4 w-4" />, module: 'weather', defaultSize: 'md' },
  { id: 'mercado', title: 'Mercado', icon: <LineChart className="h-4 w-4" />, module: 'market', defaultSize: 'md' },
  { id: 'safra', title: 'Safras ativas', icon: <Sprout className="h-4 w-4" />, module: 'seasons', defaultSize: 'md' },
  { id: 'financeiro', title: 'Financeiro', icon: <Banknote className="h-4 w-4" />, module: 'finance', defaultSize: 'md' },
  { id: 'operacao', title: 'Operação', icon: <ListChecks className="h-4 w-4" />, module: 'tasks', defaultSize: 'md' },
  { id: 'maquinas_estoque', title: 'Estoque e máquinas', icon: <Tractor className="h-4 w-4" />, module: 'inventory', defaultSize: 'sm' },
  { id: 'alertas', title: 'Alertas recentes', icon: <Bell className="h-4 w-4" />, defaultSize: 'sm' },
  { id: 'marketplace', title: 'Marketplace', icon: <Store className="h-4 w-4" />, module: 'marketplace', defaultSize: 'sm' },
]
const DEFAULT: WidgetCfg[] = CATALOG.map((c) => ({ id: c.id, size: c.defaultSize }))
const SPAN: Record<Size, string> = { sm: 'lg:col-span-1', md: 'lg:col-span-2', lg: 'lg:col-span-3' }

export function DashboardPage() {
  const { org, can, moduleEnabled, farmId, farm, profile } = useCurrentOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const prefs = useQuery({ queryKey: ['prefs', user?.id], queryFn: () => unwrap(supabase.from('user_preferences').select('*').eq('user_id', user!.id).maybeSingle()) })
  const [layout, setLayout] = useState<WidgetCfg[] | null>(null)

  useEffect(() => {
    if (prefs.isSuccess && layout === null) {
      const saved = prefs.data?.dashboard_layout as WidgetCfg[] | null | undefined
      setLayout(Array.isArray(saved) && saved.length ? saved.filter((w) => CATALOG.some((c) => c.id === w.id)) : DEFAULT)
    }
  }, [prefs.isSuccess, prefs.data, layout])

  const allowed = (id: string) => {
    const c = CATALOG.find((x) => x.id === id)
    if (!c?.module) return true
    return moduleEnabled(c.module) && (c.module === 'marketplace' || can(c.module))
  }
  const visible = (layout ?? DEFAULT).filter((w) => allowed(w.id))

  const save = async (next: WidgetCfg[]) => {
    setLayout(next)
    await supabase.from('user_preferences').upsert({ user_id: user!.id, dashboard_layout: next as never }, { onConflict: 'user_id' })
    qc.invalidateQueries({ queryKey: ['prefs'] })
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id || !layout) return
    const from = layout.findIndex((w) => w.id === e.active.id), to = layout.findIndex((w) => w.id === e.over!.id)
    void save(arrayMove(layout, from, to))
  }

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  return (
    <>
      <PageHeader title={`${greet}${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        description={`${org.name}${farm ? ` · ${farm.name}` : ' · todas as propriedades'} · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`}
        actions={editing ? <>
          <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Adicionar widget</Button>
          <Button variant="outline" onClick={() => void save(DEFAULT)}>Restaurar padrão</Button>
          <Button onClick={() => setEditing(false)}>Concluir</Button>
        </> : <span><Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Personalizar painel</Button></span>} />
      {editing && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">Arraste os widgets pelo ícone ⋮⋮ para reorganizar, altere o tamanho ou remova. As preferências são salvas no seu usuário.</p>}
      {layout === null ? <div className="grid gap-4 lg:grid-cols-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 lg:col-span-2" />)}</div> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {visible.map((w) => (
                <Widget key={w.id} cfg={w} editing={editing}
                  onRemove={() => void save(layout.filter((x) => x.id !== w.id))}
                  onResize={() => void save(layout.map((x) => (x.id === w.id ? { ...x, size: x.size === 'sm' ? 'md' : x.size === 'md' ? 'lg' : 'sm' } : x)))}>
                  <WidgetBody id={w.id} farmId={farmId} />
                </Widget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Adicionar widget" size="sm">
        <ul className="space-y-2">
          {CATALOG.filter((c) => allowed(c.id) && !layout?.some((w) => w.id === c.id)).map((c) => (
            <li key={c.id}><Button variant="outline" className="w-full justify-start" onClick={() => { void save([...(layout ?? []), { id: c.id, size: c.defaultSize }]); setAddOpen(false) }}>{c.icon}{c.title}</Button></li>
          ))}
          {CATALOG.filter((c) => allowed(c.id) && !layout?.some((w) => w.id === c.id)).length === 0 && <li className="text-sm text-muted">Todos os widgets disponíveis já estão no painel.</li>}
        </ul>
      </Dialog>
    </>
  )
}

function Widget({ cfg, editing, onRemove, onResize, children }: { cfg: WidgetCfg; editing: boolean; onRemove: () => void; onResize: () => void; children: ReactNode }) {
  const meta = CATALOG.find((c) => c.id === cfg.id)!
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cfg.id, disabled: !editing })
  return (
    <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} aria-label={meta.title}
      className={cn('card flex min-h-[160px] min-w-0 flex-col', SPAN[cfg.size], cfg.size !== 'sm' && 'md:col-span-2', isDragging && 'z-10 shadow-xl ring-2 ring-brand-500')}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        {editing && <button type="button" className="cursor-grab touch-none text-muted" aria-label={`Mover ${meta.title}`} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>}
        <span className="text-brand-700">{meta.icon}</span>
        <h2 className="text-sm font-semibold">{meta.title}</h2>
        {editing && (
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={onResize} className="rounded p-1 hover:bg-black/5" aria-label="Alterar tamanho">{cfg.size === 'lg' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button type="button" onClick={onRemove} className="rounded p-1 hover:bg-black/5" aria-label={`Remover ${meta.title}`}><X className="h-4 w-4" /></button>
          </span>
        )}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  )
}

function WidgetBody({ id, farmId }: { id: string; farmId: string | null }) {
  switch (id) {
    case 'resumo': return <SummaryWidget farmId={farmId} />
    case 'clima': return <WeatherWidget />
    case 'mercado': return <MarketWidget />
    case 'safra': return <SeasonWidget farmId={farmId} />
    case 'financeiro': return <FinanceWidget farmId={farmId} />
    case 'operacao': return <OperationWidget farmId={farmId} />
    case 'maquinas_estoque': return <StockWidget farmId={farmId} />
    case 'alertas': return <AlertsWidget />
    case 'marketplace': return <MarketplaceWidget />
    default: return null
  }
}

const Line = ({ label, value, to }: { label: ReactNode; value: ReactNode; to?: string }) => (
  <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
    <span className="text-muted">{to ? <Link to={to} className="hover:underline">{label}</Link> : label}</span>
    <span className="font-medium tabular">{value}</span>
  </div>
)

function useSummary(farmId: string | null) {
  const { orgId } = useCurrentOrg()
  return useQuery({ queryKey: ['dashboard', 'summary', orgId, farmId], queryFn: () => unwrap(supabase.rpc('dashboard_summary', { p_org: orgId, p_farm: farmId ?? undefined })) as Promise<Record<string, number | string[]>> })
}

function SummaryWidget({ farmId }: { farmId: string | null }) {
  const s = useSummary(farmId)
  if (s.isLoading) return <Skeleton className="h-28" />
  const d = s.data ?? {}
  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      <Line label="Propriedades" value={d.farms as number} to="/propriedades" />
      <Line label="Área total" value={formatArea(d.total_area_ha as number)} />
      <Line label="Área produtiva" value={formatArea(d.productive_area_ha as number)} />
      <Line label="Talhões" value={`${d.fields} (${formatArea(d.fields_area_ha as number)})`} to="/talhoes" />
      <Line label="Safras ativas" value={d.active_seasons as number} to="/safras" />
      <Line label="Culturas" value={(d.crops as string[] | undefined)?.join(', ') || '—'} />
    </div>
  )
}

function WeatherWidget() {
  const { farmId, farms } = useCurrentOrg()
  const target = farmId ?? farms.find((f) => f.latitude)?.id ?? farms[0]?.id
  const w = useWeather(target)
  if (!target) return <p className="text-sm text-muted">Cadastre uma propriedade.</p>
  if (w.isLoading) return <Skeleton className="h-28" />
  const r = w.data
  if (!r || r.status === 'unavailable') return <div className="space-y-2 text-sm"><DataStateBadge state="unavailable" /><p className="text-muted">{r && r.status === 'unavailable' ? r.message : 'Previsão indisponível.'}</p><Link to="/clima" className="text-brand-700 underline">Abrir clima</Link></div>
  const ok = r as Extract<WeatherResponse, { status: 'ok' | 'stale' }>
  const rain3 = ok.data.daily.slice(0, 3).reduce((a, d) => a + Number(d.precipitation_mm ?? 0), 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <WeatherIcon code={ok.data.current.weather_code} isDay={ok.data.current.is_day} className="h-10 w-10" />
        <div><div className="text-2xl font-semibold tabular">{formatNumber(ok.data.current.temperature_c, 1)}°C</div><div className="text-xs text-muted">{weatherLabel(ok.data.current.weather_code)} · {ok.farm.name}</div></div>
        <div className="ml-auto text-right text-xs text-muted">Umidade {ok.data.current.relative_humidity_pct}%<br />Chuva 3 dias: {formatNumber(rain3, 1)} mm</div>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-xs">
        {ok.data.daily.slice(0, 5).map((d) => (
          <div key={d.date} className="rounded bg-surface py-1.5">
            <div className="text-muted">{new Date(`${d.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
            <WeatherIcon code={d.weather_code} className="mx-auto my-0.5 h-5 w-5" />
            <div className="tabular">{formatNumber(d.temperature_max_c, 0)}°/{formatNumber(d.temperature_min_c, 0)}°</div>
            <div className="text-blue-700">{formatNumber(d.precipitation_mm, 0)} mm</div>
          </div>
        ))}
      </div>
      <SourceLine source={ok.provider} fetchedAt={ok.fetched_at} state={ok.status === 'stale' ? 'stale' : 'real'} />
    </div>
  )
}

function MarketWidget() {
  const { user } = useAuth()
  const { instruments, quotes } = useMarketData(45)
  const prefs = useQuery({ queryKey: ['prefs', user?.id], queryFn: () => unwrap(supabase.from('user_preferences').select('favorite_instruments').eq('user_id', user!.id).maybeSingle()) })
  const favs = prefs.data?.favorite_instruments ?? ['USD_BRL', 'SOJA', 'MILHO']
  const rows = useMemo(() => {
    const out: { key: string; name: string; v: number; unit: string; d1: number | null; state: ReturnType<typeof quoteState>; region: string; obs: string; source: string }[] = []
    for (const [key, s] of seriesOf(quotes.data ?? [])) {
      const inst = instruments.data?.find((i) => i.id === s[0].instrument_id)
      if (!inst || !favs.includes(inst.id)) continue
      const last = s[s.length - 1]
      out.push({ key, name: inst.name, v: Number(last.value), unit: last.unit, d1: variation(s), state: quoteState(last), region: last.region, obs: last.observed_at, source: last.source })
    }
    return out
  }, [quotes.data, instruments.data, favs])
  if (quotes.isLoading) return <Skeleton className="h-28" />
  if (!rows.length) return <p className="text-sm text-muted">Nenhuma cotação para seus favoritos. <Link className="text-brand-700 underline" to="/mercado">Abrir mercado</Link></p>
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span className="min-w-0"><span className="block truncate">{r.name}</span><span className="block truncate text-[11px] text-muted">{r.region} · ref. {formatDate(r.obs)} · {r.source}</span></span>
          <span className="text-right">
            <span className="block font-medium tabular">{formatNumber(r.v, r.unit.startsWith('BRL/USD') || r.unit.startsWith('BRL/EUR') ? 4 : 2)} <span className="text-[11px] font-normal text-muted">{r.unit}</span></span>
            <span className="flex items-center justify-end gap-1"><span className={cn('text-[11px] tabular', r.d1 !== null && (r.d1 >= 0 ? 'text-ok' : 'text-danger'))}>{formatPct(r.d1, 2)}</span>{r.state !== 'real' && <DataStateBadge state={r.state} />}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function SeasonWidget({ farmId }: { farmId: string | null }) {
  const { orgId } = useCurrentOrg()
  const q = useQuery({
    queryKey: ['dashboard', 'seasons', orgId, farmId],
    queryFn: () => { let qb = supabase.from('seasons').select('id, name, status, end_date, is_demo, expected_yield_per_ha, crops(name, yield_unit), season_fields(planted_area_ha, stage, planting_date, expected_harvest_date)').eq('organization_id', orgId).in('status', ['planejada', 'em_andamento']).is('archived_at', null).limit(5); if (farmId) qb = qb.eq('farm_id', farmId); return unwrap(qb) },
  })
  if (q.isLoading) return <Skeleton className="h-28" />
  if (!q.data?.length) return <p className="text-sm text-muted">Nenhuma safra ativa. <Link className="text-brand-700 underline" to="/safras">Planejar safra</Link></p>
  return (
    <ul className="space-y-3">
      {q.data.map((s) => {
        const sf = s.season_fields as { planted_area_ha: number | null; stage: string | null; planting_date: string | null; expected_harvest_date: string | null }[]
        const area = sf.reduce((a, x) => a + Number(x.planted_area_ha ?? 0), 0)
        const crop = s.crops as { name: string; yield_unit: string } | null
        const plant = sf.map((x) => x.planting_date).filter(Boolean).sort()[0]
        const harvest = sf.map((x) => x.expected_harvest_date).filter(Boolean).sort().at(-1)
        return (
          <li key={s.id} className="text-sm">
            <Link to={`/safras/${s.id}`} className="flex items-center gap-2 font-medium hover:underline"><Wheat className="h-4 w-4 text-wheat-400" />{s.name}<DemoBadge show={s.is_demo} /></Link>
            <div className="mt-0.5 text-xs text-muted">
              {crop?.name} · {formatArea(area)} · estágio {sf.map((x) => x.stage).filter(Boolean)[0] ?? '—'} · plantio {formatDate(plant)} · colheita prev. {formatDate(harvest)}
              {s.expected_yield_per_ha && ` · meta ${formatNumber(s.expected_yield_per_ha)} ${crop?.yield_unit}/ha (est. ${formatNumber(Number(s.expected_yield_per_ha) * area, 0)} ${crop?.yield_unit})`}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function FinanceWidget({ farmId }: { farmId: string | null }) {
  const { orgId } = useCurrentOrg()
  const start = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const end = toISODate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  const q = useQuery({
    queryKey: ['dashboard', 'finance', orgId, farmId, start],
    queryFn: async () => {
      let month = supabase.from('transactions').select('kind, amount, status, due_date, paid_date').eq('organization_id', orgId).gte('due_date', start).lte('due_date', end).is('archived_at', null)
      let due = supabase.from('transactions').select('id, description, amount, kind, due_date').eq('organization_id', orgId).eq('status', 'pendente').lte('due_date', toISODate(new Date(Date.now() + 7 * 86400000))).is('archived_at', null).order('due_date').limit(5)
      if (farmId) { month = month.eq('farm_id', farmId); due = due.eq('farm_id', farmId) }
      const [m, d] = await Promise.all([unwrap(month), unwrap(due)])
      return { month: m, due: d }
    },
  })
  if (q.isLoading) return <Skeleton className="h-28" />
  const s = summarize(q.data?.month ?? [], toISODate())
  return (
    <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
      <div>
        <div className="mb-1 text-xs font-medium text-muted">Este mês (por vencimento)</div>
        <Line label="Receitas" value={<span className="text-ok">{formatBRL(s.revenue)}</span>} />
        <Line label="Despesas" value={<span className="text-danger">{formatBRL(s.expense)}</span>} />
        <Line label="Saldo" value={formatBRL(s.result)} />
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-muted">Vencendo em 7 dias / vencidas</div>
        {!q.data?.due.length ? <p className="text-sm text-muted">Nada a vencer.</p> : q.data.due.map((t) => (
          <Line key={t.id} label={<span className={t.due_date < toISODate() ? 'text-danger' : ''}>{formatDate(t.due_date)} · {t.description}</span>} value={`${t.kind === 'despesa' ? '−' : '+'}${formatBRL(t.amount)}`} to="/financeiro" />
        ))}
      </div>
    </div>
  )
}

function OperationWidget({ farmId }: { farmId: string | null }) {
  const { orgId } = useCurrentOrg()
  const s = useSummary(farmId)
  const acts = useQuery({ queryKey: ['dashboard', 'acts', orgId, farmId], queryFn: () => { let q = supabase.from('activities').select('id, title, started_at, activity_types(name), fields(name)').eq('organization_id', orgId).order('started_at', { ascending: false }).limit(4); if (farmId) q = q.eq('farm_id', farmId); return unwrap(q) } })
  return (
    <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
      <div>
        <Line label="Tarefas para hoje" value={(s.data?.tasks_today as number) ?? '—'} to="/tarefas" />
        <Line label="Tarefas em aberto" value={(s.data?.tasks_open as number) ?? '—'} to="/tarefas" />
        <Line label="Tarefas atrasadas" value={<span className={Number(s.data?.tasks_overdue) ? 'text-danger' : ''}>{(s.data?.tasks_overdue as number) ?? '—'}</span>} to="/tarefas" />
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-muted">Operações recentes</div>
        {(acts.data ?? []).map((a) => (
          <div key={a.id} className="truncate py-0.5 text-sm"><span className="text-muted">{formatDate(a.started_at)}</span> · {(a.activity_types as { name: string } | null)?.name}{(a.fields as { name: string } | null) && ` — ${(a.fields as { name: string }).name}`}</div>
        ))}
        {!acts.data?.length && <p className="text-sm text-muted">Sem registros.</p>}
      </div>
    </div>
  )
}

function StockWidget({ farmId }: { farmId: string | null }) {
  const s = useSummary(farmId)
  return (
    <div>
      <Line label="Itens abaixo do mínimo" value={<span className={Number(s.data?.low_stock) ? 'text-danger' : ''}>{(s.data?.low_stock as number) ?? '—'}</span>} to="/estoque" />
      <Line label="Manutenções próximas/vencidas" value={<span className={Number(s.data?.maintenance_due) ? 'text-warn' : ''}>{(s.data?.maintenance_due as number) ?? '—'}</span>} to="/maquinas" />
      <Line label="Documentos vencendo (30 d)" value={(s.data?.docs_expiring as number) ?? '—'} to="/documentos" />
    </div>
  )
}

function AlertsWidget() {
  const q = useQuery({ queryKey: ['notifications', 'widget'], queryFn: () => unwrap(supabase.from('notifications').select('id, title, category, priority, created_at, read_at').is('archived_at', null).order('created_at', { ascending: false }).limit(5)) })
  if (q.isLoading) return <Skeleton className="h-28" />
  if (!q.data?.length) return <p className="text-sm text-muted">Nenhum alerta recente.</p>
  return (
    <ul className="space-y-2">
      {q.data.map((n) => (
        <li key={n.id} className="text-sm">
          <Link to="/notificacoes" className={cn('block truncate hover:underline', !n.read_at && 'font-medium')}>{n.title}</Link>
          <span className="text-[11px] text-muted">{n.category} · {relativeTime(n.created_at)} {n.priority === 'alta' || n.priority === 'critica' ? <Badge tone="red">{n.priority}</Badge> : null}</span>
        </li>
      ))}
    </ul>
  )
}

function MarketplaceWidget() {
  const c = useQuery({ queryKey: ['mp-counters'], queryFn: async () => (await unwrap(supabase.rpc('marketplace_counters')))[0] })
  const recent = useQuery({ queryKey: ['mp-recent'], queryFn: () => unwrap(supabase.from('listings').select('id, title, price, city, state').eq('status', 'publicado').order('published_at', { ascending: false }).limit(3)) })
  return (
    <div>
      <Line label="Mensagens não lidas" value={c.data?.unread_messages ?? '—'} to="/marketplace/mensagens" />
      <Line label="Anúncios salvos" value={c.data?.favorites ?? '—'} to="/marketplace/favoritos" />
      <Line label="Meus anúncios ativos" value={c.data?.my_active_listings ?? '—'} to="/marketplace/meus-anuncios" />
      <div className="mt-2 border-t border-line pt-2">
        {(recent.data ?? []).map((l) => <Link key={l.id} to={`/marketplace/anuncio/${l.id}`} className="block truncate py-0.5 text-sm hover:underline">{l.title} <span className="text-xs text-muted">· {l.price ? formatBRL(l.price) : 'a combinar'} · {l.city}/{l.state}</span></Link>)}
      </div>
    </div>
  )
}
