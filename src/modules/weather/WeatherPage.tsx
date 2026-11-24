import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CloudOff, ExternalLink, RefreshCw } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Select } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { EmptyState, ErrorState, LoadingRows, SourceLine } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { WeatherIcon } from '@/components/feedback/WeatherIcon'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { useWeather } from '@/hooks/useWeather'
import { getWeather, weatherLabel, windDir, type WeatherResponse } from '@/services/providers/weather'

export const RULE_KINDS = [
  { value: 'chuva_intensa', label: 'Chuva intensa (mm/dia ≥)', unit: 'mm' },
  { value: 'chuva_acumulada', label: 'Chuva acumulada no período (mm ≥)', unit: 'mm' },
  { value: 'estiagem', label: 'Estiagem (dias seguidos sem chuva ≥)', unit: 'dias' },
  { value: 'calor', label: 'Calor (máxima °C ≥)', unit: '°C' },
  { value: 'frio', label: 'Frio (mínima °C ≤)', unit: '°C' },
  { value: 'geada', label: 'Risco de geada (mínima °C ≤)', unit: '°C' },
  { value: 'vento_forte', label: 'Vento/rajada forte (km/h ≥)', unit: 'km/h' },
]

export function WeatherPage() {
  const { orgId, farms, farmId, can } = useCurrentOrg()
  const [selected, setSelected] = useState<string | null>(farmId ?? farms[0]?.id ?? null)
  const active = farmId ?? selected
  const w = useWeather(active)
  const [refreshing, setRefreshing] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)

  const rules = useQuery({ queryKey: ['weather-rules', active], enabled: !!active, queryFn: () => unwrap(supabase.from('weather_alert_rules').select('*').eq('farm_id', active!).order('created_at')) })
  const events = useQuery({ queryKey: ['weather-events', active], enabled: !!active, queryFn: () => unwrap(supabase.from('weather_alert_events').select('*').eq('farm_id', active!).order('created_at', { ascending: false }).limit(50)) })
  const addRule = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('weather_alert_rules').insert({ ...v, organization_id: orgId, farm_id: active! } as never)), { invalidate: [['weather-rules']] })
  const toggleRule = useAppMutation(async ({ id, enabled }: { id: string; enabled: boolean }) => unwrap(supabase.from('weather_alert_rules').update({ enabled }).eq('id', id)), { invalidate: [['weather-rules']] })
  const delRule = useAppMutation(async (id: string) => unwrap(supabase.from('weather_alert_rules').delete().eq('id', id)), { invalidate: [['weather-rules']], success: 'Regra removida' })

  const refresh = async () => {
    if (!active) return
    setRefreshing(true)
    try { await getWeather(active, true); await w.refetch(); await events.refetch() } finally { setRefreshing(false) }
  }

  const ruleFields: FieldDef[] = [
    { name: 'kind', label: 'Tipo de alerta', type: 'select', required: true, options: RULE_KINDS.map(({ value, label }) => ({ value, label })), span: 3 },
    { name: 'threshold', label: 'Limite', type: 'number', required: true, span: 1 },
    { name: 'lookahead_days', label: 'Antecedência (dias)', type: 'number', required: true, min: 1, max: 7, span: 1 },
    { name: 'priority', label: 'Prioridade', type: 'select', required: true, options: [{ value: 'baixa', label: 'Baixa' }, { value: 'media', label: 'Média' }, { value: 'alta', label: 'Alta' }, { value: 'critica', label: 'Crítica' }], span: 1 },
    { name: 'notes', label: 'Observação', type: 'text', maxLength: 200, span: 3 },
  ]

  if (!farms.length) return <><PageHeader title="Clima" /><EmptyState title="Cadastre uma propriedade" description="A previsão é obtida pela localização de cada propriedade." /></>

  const r = w.data
  const ok = r && r.status !== 'unavailable' ? (r as Extract<WeatherResponse, { status: 'ok' | 'stale' }>) : null
  const past7 = ok ? ok.data.past_daily.reduce((s, d) => s + Number(d.precipitation_mm ?? 0), 0) : null
  const next7 = ok ? ok.data.daily.reduce((s, d) => s + Number(d.precipitation_mm ?? 0), 0) : null
  const chart = ok ? ok.data.daily.map((d) => ({ dia: formatDate(d.date).slice(0, 5), chuva: d.precipitation_mm, max: d.temperature_max_c, min: d.temperature_min_c, prob: d.precipitation_probability_pct })) : []

  type Ev = NonNullable<typeof events.data>[number]
  const evCols: Column<Ev>[] = [
    { key: 'at', header: 'Gerado em', value: (x) => x.created_at, cell: (x) => formatDateTime(x.created_at) },
    { key: 'msg', header: 'Alerta', primary: true, value: (x) => x.message, cell: (x) => x.message },
    { key: 'for', header: 'Para o dia', value: (x) => x.forecast_for, cell: (x) => formatDate(x.forecast_for) },
    { key: 'src', header: 'Fonte', value: (x) => x.provider, cell: (x) => <span className="text-xs">{x.provider} · previsão de {formatDateTime(x.fetched_at)}</span> },
  ]

  return (
    <>
      <PageHeader title="Clima e alertas" crumbs={[{ label: 'Visão geral' }, { label: 'Clima' }]}
        description="Previsão por propriedade com fonte, horário de atualização e validade. Previsão não é certeza e não substitui avisos oficiais."
        actions={<>
          {!farmId && farms.length > 1 && <Select aria-label="Propriedade" value={active ?? ''} onChange={(e) => setSelected(e.target.value)} className="h-9 w-56">{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>}
          <Button variant="outline" onClick={() => void refresh()} loading={refreshing}><RefreshCw className="h-4 w-4" />Atualizar</Button>
        </>} />

      {w.isLoading ? <LoadingRows rows={6} /> : w.error ? <ErrorState error={w.error} onRetry={() => w.refetch()} /> : !ok ? (
        <div className="card">
          <EmptyState icon={<CloudOff className="h-6 w-6" />} title={r && r.status === 'unavailable' && r.reason === 'no_coordinates' ? 'Propriedade sem localização' : 'Previsão indisponível'}
            description={r && r.status === 'unavailable' ? r.message : undefined}
            action={r && r.status === 'unavailable' && r.reason === 'no_coordinates' ? <Link to={`/propriedades/${active}`}><Button>Informar coordenadas</Button></Link> : undefined} />
        </div>
      ) : (
        <div className="space-y-5">
          {ok.status === 'stale' && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4" />A fonte não respondeu na última tentativa{ok.last_error_at ? ` (${formatDateTime(ok.last_error_at)})` : ''}. Exibindo a última previsão armazenada, de {formatDateTime(ok.fetched_at)}.
            </div>
          )}
          <Card>
            <div className="flex flex-wrap items-center gap-4 p-4 sm:gap-6 sm:p-5">
              <div className="flex items-center gap-4">
                <WeatherIcon code={ok.data.current.weather_code} isDay={ok.data.current.is_day} className="h-12 w-12" />
                <div>
                  <div className="text-4xl font-semibold tabular">{formatNumber(ok.data.current.temperature_c, 1)}°C</div>
                  <div className="text-sm text-muted">{weatherLabel(ok.data.current.weather_code)} · sensação {formatNumber(ok.data.current.apparent_temperature_c, 0)}°C</div>
                </div>
              </div>
              <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:w-auto sm:flex-1 sm:grid-cols-4">
                <StatCard label="Umidade" value={`${ok.data.current.relative_humidity_pct}%`} />
                <StatCard label="Vento" value={`${formatNumber(ok.data.current.wind_speed_kmh, 0)} km/h`} hint={`${windDir(ok.data.current.wind_direction_deg)} · rajadas ${formatNumber(ok.data.current.wind_gusts_kmh, 0)} km/h`} />
                <StatCard label="Chuva últimos 7 dias" value={`${formatNumber(past7, 1)} mm`} hint="Estimativa do modelo (não é medição local)" />
                <StatCard label="Chuva prevista 7 dias" value={`${formatNumber(next7, 1)} mm`} />
              </div>
            </div>
            <div className="border-t border-line px-5 py-2.5">
              <SourceLine source={ok.provider} sourceUrl={ok.provider_url} fetchedAt={ok.fetched_at} state={ok.status === 'stale' ? 'stale' : 'real'}
                extra={<><span>Tipo: previsão/modelo numérico</span><span>Válido até {formatDateTime(ok.valid_until)}</span><span>Ponto de grade {ok.grid.lat}, {ok.grid.lon}</span></>} />
              <p className="mt-1 text-[11px] text-muted">{ok.license}</p>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Próximos 7 dias" description="Chuva prevista (mm), temperaturas máx./mín. (°C)" />
              <div className="h-72 p-4">
                <ResponsiveContainer>
                  <ComposedChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="mm" tick={{ fontSize: 11 }} width={40} unit=" mm" />
                    <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} width={40} unit="°" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="mm" dataKey="chuva" name="Chuva (mm)" fill="#175cd3" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="c" dataKey="max" name="Máx. (°C)" stroke="#b42318" strokeWidth={2} />
                    <Line yAxisId="c" dataKey="min" name="Mín. (°C)" stroke="#0e7490" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Previsão diária" />
              <ul className="divide-y divide-line">
                {ok.data.daily.map((d) => (
                  <li key={d.date} className="grid grid-cols-[70px_28px_1fr_auto] items-center gap-2 px-4 py-2 text-sm">
                    <span className="text-muted">{new Date(`${d.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}</span>
                    <WeatherIcon code={d.weather_code} />
                    <span className="truncate text-xs text-muted">{weatherLabel(d.weather_code)} · {formatNumber(d.precipitation_mm, 1)} mm ({d.precipitation_probability_pct ?? '—'}%) · vento {formatNumber(d.wind_gusts_max_kmh, 0)} km/h</span>
                    <span className="tabular"><span className="text-danger">{formatNumber(d.temperature_max_c, 0)}°</span> / <span className="text-cyan-700">{formatNumber(d.temperature_min_c, 0)}°</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title="Próximas 24 horas" />
            <div className="flex gap-2 overflow-x-auto p-4 scrollbar-thin">
              {ok.data.hourly.slice(0, 24).map((h) => (
                <div key={h.time} className="min-w-[64px] rounded-lg bg-surface p-2 text-center text-xs">
                  <div className="text-muted">{h.time.slice(11, 16)}</div>
                  <WeatherIcon code={h.weather_code} className="mx-auto my-1 h-5 w-5" />
                  <div className="font-medium tabular">{formatNumber(h.temperature_c, 0)}°</div>
                  <div className="text-blue-700">{h.precipitation_probability_pct ?? 0}%</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras de alerta desta propriedade" description="Avaliadas a cada coleta (inclusive automática, a cada hora). Notificações deduplicadas por regra e dia."
            actions={can('weather', 'view') && <Button size="sm" onClick={() => setRuleOpen(true)}>Nova regra</Button>} />
          <ul className="divide-y divide-line">
            {(rules.data ?? []).map((ru) => {
              const k = RULE_KINDS.find((x) => x.value === ru.kind)
              return (
                <li key={ru.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>{k?.label.split(' (')[0]} — limite <strong>{formatNumber(ru.threshold)} {k?.unit}</strong> · {ru.lookahead_days} dia(s) · <Badge tone={ru.priority === 'alta' || ru.priority === 'critica' ? 'red' : 'neutral'}>{ru.priority}</Badge>{ru.is_demo && <Badge tone="orange" className="ml-1">demo</Badge>}</span>
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleRule.mutate({ id: ru.id, enabled: !ru.enabled })}>{ru.enabled ? 'Pausar' : 'Ativar'}</Button>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => delRule.mutate(ru.id)}>Excluir</Button>
                  </span>
                </li>
              )
            })}
            {!rules.data?.length && <li className="px-5 py-6 text-center text-sm text-muted">Nenhuma regra. Crie alertas de chuva, calor, geada ou vento.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Avisos oficiais" />
          <div className="space-y-3 p-5 text-sm">
            <p>Para avisos meteorológicos oficiais (severidade, área e validade), consulte sempre o INMET. A integração automática será ativada após validação de formato, estabilidade e autorização da fonte.</p>
            <a href="https://alertas2.inmet.gov.br/" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-brand-700 underline">Abrir avisos do INMET <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </Card>
      </div>
      <div className="mt-5">
        <h2 className="mb-2 text-base font-semibold">Histórico de alertas gerados</h2>
        <DataTable rows={events.data} columns={evCols} loading={events.isLoading} error={events.error} exportName="Alertas de clima" />
      </div>
      <ResourceFormDialog open={ruleOpen} onOpenChange={setRuleOpen} title="Nova regra de alerta" size="md" fields={ruleFields}
        defaults={{ kind: 'chuva_intensa', threshold: 40, lookahead_days: 3, priority: 'alta' }} onSubmit={(v) => addRule.mutateAsync(v)} />
    </>
  )
}
