import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus, RefreshCw, Star } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Select } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DataStateBadge, EmptyState, SourceLine } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatNumber, formatPct } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'
import { quoteState, syncOfficialQuotes, variation, type Quote } from '@/services/providers/market'

import { useMarketData, seriesOf, type Instrument } from '@/hooks/useMarket'

export function MarketPage() {
  const { orgId, can } = useCurrentOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { instruments, quotes } = useMarketData(365)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [range, setRange] = useState(90)

  const prefs = useQuery({ queryKey: ['prefs', user?.id], queryFn: () => unwrap(supabase.from('user_preferences').select('*').eq('user_id', user!.id).maybeSingle()) })
  const favorites = prefs.data?.favorite_instruments ?? ['USD_BRL', 'SOJA', 'MILHO']
  const rules = useQuery({ queryKey: ['price-rules', user?.id], queryFn: () => unwrap(supabase.from('price_alert_rules').select('*, market_instruments(name, unit)').eq('organization_id', orgId).order('created_at')) })
  const alertEvents = useQuery({ queryKey: ['price-events', user?.id], queryFn: () => unwrap(supabase.from('price_alert_events').select('*, price_alert_rules(instrument_id, market_instruments(name, unit))').order('created_at', { ascending: false }).limit(30)) })

  const toggleFav = useAppMutation(async (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]
    return unwrap(supabase.from('user_preferences').upsert({ user_id: user!.id, favorite_instruments: next }, { onConflict: 'user_id' }))
  }, { invalidate: [['prefs']] })
  const addManual = useAppMutation(async (v: Record<string, unknown>) => {
    const inst = instruments.data?.find((i) => i.id === v.instrument_id)
    const isDemo = v.status === 'demonstrativo'
    return unwrap(supabase.from('market_quotes').insert({ ...v, organization_id: orgId, unit: v.unit ?? inst?.unit, currency: 'BRL', is_demo: isDemo, observed_at: new Date(`${v.observed_date as string}T15:00:00`).toISOString(), observed_date: undefined } as never))
  }, { invalidate: [['market-quotes']] })
  const addRule = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('price_alert_rules').insert({ ...v, organization_id: orgId, instrument_id: alertOpen } as never)), { invalidate: [['price-rules']] })
  const delRule = useAppMutation(async (id: string) => unwrap(supabase.from('price_alert_rules').delete().eq('id', id)), { invalidate: [['price-rules']], success: 'Alerta removido' })

  const doSync = async () => {
    setSyncing(true)
    try {
      const r = await syncOfficialQuotes()
      if (r.errors.length) toast.warning(`Algumas séries falharam: ${r.errors.join('; ')}`)
      else toast.success(r.skipped ? 'Dados oficiais já estão atualizados (coleta há menos de 30 min)' : `${r.inserted} nova(s) cotação(ões) oficial(is)`)
      qc.invalidateQueries({ queryKey: ['market-quotes'] })
    } catch (e) { toast.error(toUserMessage(e)) } finally { setSyncing(false) }
  }

  const series = useMemo(() => seriesOf(quotes.data ?? []), [quotes.data])
  const cards = useMemo(() => {
    const out: { key: string; inst: Instrument; last: Quote; d1: number | null; d7: number | null; d30: number | null; min: number; max: number; series: Quote[] }[] = []
    for (const [key, s] of series) {
      const inst = instruments.data?.find((i) => i.id === s[0].instrument_id)
      if (!inst) continue
      const last = s[s.length - 1]
      const vals = s.map((x) => Number(x.value))
      out.push({ key, inst, last, d1: variation(s), d7: variation(s, 7), d30: variation(s, 30), min: Math.min(...vals), max: Math.max(...vals), series: s })
    }
    return out.sort((a, b) => (favorites.includes(b.inst.id) ? 1 : 0) - (favorites.includes(a.inst.id) ? 1 : 0) || a.inst.sort - b.inst.sort)
  }, [series, instruments.data, favorites])
  const withoutData = (instruments.data ?? []).filter((i) => !cards.some((c) => c.inst.id === i.id))
  const sel = cards.find((c) => c.key === selectedKey) ?? cards[0]
  const chartData = sel ? sel.series.filter((q) => Date.now() - new Date(q.observed_at).getTime() <= range * 86400000).map((q) => ({ d: formatDate(q.observed_at), v: Number(q.value) })) : []

  const manualFields: FieldDef[] = [
    { name: 'instrument_id', label: 'Produto/indicador', type: 'select', required: true, options: (instruments.data ?? []).map((i) => ({ value: i.id, label: i.name })), span: 2 },
    { name: 'status', label: 'Tipo de dado', type: 'select', required: true, options: [{ value: 'manual', label: 'Manual (preço que obtive)' }, { value: 'demonstrativo', label: 'Demonstrativo (fictício)' }], span: 1 },
    { name: 'value', label: 'Valor', type: 'number', required: true, min: 0.000001, span: 1 },
    { name: 'unit', label: 'Unidade', type: 'text', required: true, maxLength: 40, span: 1, placeholder: 'BRL/sc 60 kg' },
    { name: 'observed_date', label: 'Data de referência', type: 'date', required: true, span: 1 },
    { name: 'region', label: 'Praça / região', type: 'text', required: true, maxLength: 80, span: 2, placeholder: 'Ex.: Rio Verde (GO)' },
    { name: 'source', label: 'Fonte', type: 'text', required: true, maxLength: 120, span: 1, placeholder: 'Ex.: Cooperativa X' },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 500, span: 3 },
  ]

  type Rule = NonNullable<typeof rules.data>[number]
  const ruleCols: Column<Rule>[] = [
    { key: 'inst', header: 'Indicador', primary: true, value: (r) => (r.market_instruments as { name: string } | null)?.name, cell: (r) => (r.market_instruments as { name: string } | null)?.name },
    { key: 'cond', header: 'Condição', value: (r) => r.direction, cell: (r) => `${r.direction === 'acima' ? '≥' : '≤'} ${formatNumber(r.target_value, 4)} ${(r.market_instruments as { unit: string } | null)?.unit ?? ''}` },
    { key: 'region', header: 'Praça', value: (r) => r.region, cell: (r) => r.region ?? 'Qualquer' },
    { key: 'last', header: 'Último disparo', value: (r) => r.last_triggered_at, cell: (r) => formatDateTime(r.last_triggered_at) },
    { key: 'act', header: '', align: 'right', cell: (r) => r.user_id === user?.id ? <Button variant="ghost" size="sm" className="text-danger" onClick={() => delRule.mutate(r.id)}>Excluir</Button> : null },
  ]

  return (
    <>
      <PageHeader title="Mercado agrícola e câmbio" crumbs={[{ label: 'Visão geral' }, { label: 'Mercado' }]}
        description="Cada valor exibe fonte, praça, unidade, data de referência e status. Séries de praças, fontes ou unidades diferentes nunca são misturadas."
        actions={<>
          <Button variant="outline" onClick={() => void doSync()} loading={syncing}><RefreshCw className="h-4 w-4" />Atualizar câmbio oficial</Button>
          {can('market', 'create') && <Button onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" />Lançar cotação</Button>}
        </>} />

      {quotes.isLoading ? null : !cards.length && (
        <div className="card mb-5"><EmptyState title="Nenhuma cotação armazenada" description="Clique em “Atualizar câmbio oficial” para buscar as séries do Banco Central, ou lance cotações manuais." /></div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const st = quoteState(c.last)
          return (
            <button key={c.key} type="button" onClick={() => setSelectedKey(c.key)}
              className={cn('card p-4 text-left transition-colors hover:border-brand-300', sel?.key === c.key && 'border-brand-500 ring-2 ring-brand-500/20')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.inst.name}</div>
                  <div className="truncate text-[11px] text-muted">{c.last.region} · {c.last.source}</div>
                </div>
                <span role="button" tabIndex={0} aria-label={favorites.includes(c.inst.id) ? 'Remover dos favoritos' : 'Favoritar'} onClick={(e) => { e.stopPropagation(); toggleFav.mutate(c.inst.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleFav.mutate(c.inst.id) } }}>
                  <Star className={cn('h-4 w-4', favorites.includes(c.inst.id) ? 'fill-wheat-400 text-wheat-400' : 'text-muted')} />
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular">{formatNumber(c.last.value, c.inst.kind === 'cambio' ? 4 : 2)}</div>
              <div className="text-[11px] text-muted">{c.last.unit} · ref. {formatDate(c.last.observed_at)}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs tabular">
                <span className={cn(c.d1 !== null && (c.d1 >= 0 ? 'text-ok' : 'text-danger'))}>dia {formatPct(c.d1, 2)}</span>
                <span className="text-muted">7d {formatPct(c.d7, 1)}</span>
                <span className="text-muted">30d {formatPct(c.d30, 1)}</span>
              </div>
              <div className="mt-2"><DataStateBadge state={st} /></div>
            </button>
          )
        })}
      </div>

      {sel && (
        <Card className="mt-5">
          <CardHeader title={`${sel.inst.name} — histórico`} description={`${sel.last.region} · ${sel.last.unit} · mín. ${formatNumber(sel.min, 4)} / máx. ${formatNumber(sel.max, 4)} no período armazenado`}
            actions={<>
              <Select aria-label="Período" value={range} onChange={(e) => setRange(Number(e.target.value))} className="h-8 w-32 text-xs"><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>1 ano</option></Select>
              <Button size="sm" variant="outline" onClick={() => setAlertOpen(sel.inst.id)}><Bell className="h-4 w-4" />Alerta de preço</Button>
            </>} />
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={60} />
                <Tooltip formatter={(v) => `${formatNumber(Number(v), 4)} ${sel.last.unit}`} />
                <Line dataKey="v" name={sel.inst.name} stroke={sel.last.status === 'demonstrativo' ? '#c2410c' : '#215335'} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-line px-5 py-2.5">
            <SourceLine source={sel.last.source} sourceUrl={sel.last.source_url} observedAt={sel.last.observed_at} fetchedAt={sel.last.fetched_at} unit={sel.last.unit} state={quoteState(sel.last)}
              extra={<span>Status: {sel.last.status}</span>} />
            {sel.inst.description && <p className="mt-1 text-[11px] text-muted">{sel.inst.description}</p>}
          </div>
        </Card>
      )}

      {withoutData.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Indicadores sem fonte configurada" description="Não exibimos preços inventados. Lance cotações manuais (com fonte e praça) ou contrate um fornecedor licenciado." />
          <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {withoutData.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
                <span>{i.name} <span className="text-xs text-muted">({i.unit})</span></span>
                <DataStateBadge state="unavailable" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-base font-semibold">Meus alertas de preço</h2>
          <DataTable rows={rules.data} columns={ruleCols} loading={rules.isLoading} error={rules.error} empty={<EmptyState title="Nenhum alerta" description="Selecione um indicador e crie um alerta de preço-alvo." />} />
        </div>
        <Card>
          <CardHeader title="Alertas disparados" description="Disparo ao cruzar o alvo (não repete enquanto permanecer além dele)." />
          <ul className="divide-y divide-line">
            {(alertEvents.data ?? []).map((e) => {
              const r = e.price_alert_rules as { market_instruments: { name: string; unit: string } | null } | null
              return <li key={e.id} className="px-5 py-2.5 text-sm">{r?.market_instruments?.name}: {formatNumber(e.value, 4)} ({e.direction === 'acima' ? '≥' : '≤'} {formatNumber(e.target_value, 4)}) <span className="text-xs text-muted">· {formatDateTime(e.created_at)}</span></li>
            })}
            {!alertEvents.data?.length && <li className="px-5 py-6 text-center text-sm text-muted">Nenhum alerta disparado.</li>}
          </ul>
        </Card>
      </div>
      <p className="mt-6 text-[11px] text-muted">
        Câmbio: Banco Central do Brasil (SGS), taxa de referência diária — não é preço negociável em tempo real. Cotações agrícolas (CEPEA, CONAB etc.) exigem licença para uso comercial e não estão integradas.
        <Badge className="ml-1">{instruments.data?.length ?? 0} indicadores</Badge>
      </p>

      <ResourceFormDialog open={manualOpen} onOpenChange={setManualOpen} title="Lançar cotação" description="Informe sempre a fonte e a praça. Cotações manuais ficam visíveis apenas para sua organização."
        fields={manualFields} defaults={{ status: 'manual', observed_date: new Date().toISOString().slice(0, 10), instrument_id: 'SOJA', unit: 'BRL/sc 60 kg' }}
        onSubmit={(v) => { const { observed_date, ...rest } = v; return addManual.mutateAsync({ ...rest, observed_date }) }} />
      <ResourceFormDialog open={!!alertOpen} onOpenChange={(o) => !o && setAlertOpen(null)} title={`Alerta de preço — ${instruments.data?.find((i) => i.id === alertOpen)?.name ?? ''}`} size="md"
        fields={[
          { name: 'direction', label: 'Quando o valor ficar', type: 'select', required: true, options: [{ value: 'acima', label: 'Igual ou acima de' }, { value: 'abaixo', label: 'Igual ou abaixo de' }], span: 2 },
          { name: 'target_value', label: 'Valor-alvo', type: 'number', required: true, min: 0.000001, span: 1 },
          { name: 'region', label: 'Praça (opcional)', type: 'text', maxLength: 80, span: 3, hint: 'Vazio = qualquer praça/fonte do indicador' },
        ]} defaults={{ direction: 'acima' }} onSubmit={(v) => addRule.mutateAsync(v)} />
    </>
  )
}
