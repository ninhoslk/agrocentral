// AgroCentral — Edge Function "weather"
// Adaptador de previsão do tempo (Open-Meteo) com cache por coordenada, rastreabilidade
// (fonte, horário, validade, status) e avaliação de regras de alerta.
// Modos: usuário autenticado ({ farm_id }) ou agendado (header x-cron-secret).
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const PROVIDER = 'open-meteo'
const TTL_MINUTES = 60
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',')

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allow = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin || '*' : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })

const round = (v: number, step = 0.05) => Math.round(v / step) * step

interface Normalized {
  location: { lat: number; lon: number; elevation_m: number | null }
  timezone: string
  current: Record<string, number | string | null>
  hourly: Record<string, number | string | null>[]
  daily: Record<string, number | string | null>[]
  past_daily: { date: string; precipitation_mm: number | null }[]
  units: Record<string, string>
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<{ data: Normalized; url: string }> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2), longitude: lon.toFixed(2), timezone: 'America/Sao_Paulo', wind_speed_unit: 'kmh',
    past_days: '7', forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,et0_fao_evapotranspiration',
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10_000)
  const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'AgroCentral/0.1' } }).finally(() => clearTimeout(t))
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`)
  const r = await res.json()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const daily = (r.daily.time as string[]).map((d, i) => ({
    date: d,
    weather_code: r.daily.weather_code[i],
    temperature_max_c: r.daily.temperature_2m_max[i],
    temperature_min_c: r.daily.temperature_2m_min[i],
    precipitation_mm: r.daily.precipitation_sum[i],
    precipitation_probability_pct: r.daily.precipitation_probability_max[i],
    wind_speed_max_kmh: r.daily.wind_speed_10m_max[i],
    wind_gusts_max_kmh: r.daily.wind_gusts_10m_max[i],
    wind_direction_deg: r.daily.wind_direction_10m_dominant[i],
    uv_index_max: r.daily.uv_index_max[i],
    et0_mm: r.daily.et0_fao_evapotranspiration[i],
  }))
  const nowIso = new Date().toISOString().slice(0, 13)
  const hourly = (r.hourly.time as string[]).map((tm, i) => ({
    time: tm,
    temperature_c: r.hourly.temperature_2m[i],
    relative_humidity_pct: r.hourly.relative_humidity_2m[i],
    precipitation_probability_pct: r.hourly.precipitation_probability[i],
    precipitation_mm: r.hourly.precipitation[i],
    wind_speed_kmh: r.hourly.wind_speed_10m[i],
    wind_gusts_kmh: r.hourly.wind_gusts_10m[i],
    weather_code: r.hourly.weather_code[i],
  }))
  const startIdx = Math.max(0, hourly.findIndex((h) => new Date(`${h.time}:00-03:00`).toISOString().slice(0, 13) >= nowIso))
  return {
    url,
    data: {
      location: { lat: r.latitude, lon: r.longitude, elevation_m: r.elevation ?? null },
      timezone: r.timezone,
      current: {
        time: r.current.time,
        temperature_c: r.current.temperature_2m,
        apparent_temperature_c: r.current.apparent_temperature,
        relative_humidity_pct: r.current.relative_humidity_2m,
        precipitation_mm: r.current.precipitation,
        weather_code: r.current.weather_code,
        wind_speed_kmh: r.current.wind_speed_10m,
        wind_direction_deg: r.current.wind_direction_10m,
        wind_gusts_kmh: r.current.wind_gusts_10m,
        is_day: r.current.is_day,
      },
      hourly: hourly.slice(startIdx, startIdx + 48),
      daily: daily.filter((d) => d.date >= today),
      past_daily: daily.filter((d) => d.date < today).map((d) => ({ date: d.date, precipitation_mm: d.precipitation_mm })),
      units: { temperature: '°C', precipitation: 'mm', wind: 'km/h', humidity: '%' },
    },
  }
}

async function log(admin: SupabaseClient, status: string, started: number, http?: number, error?: string) {
  await admin.from('integration_logs').insert({ provider: PROVIDER, endpoint: '/v1/forecast', status, http_status: http ?? null, duration_ms: Date.now() - started, error: error?.slice(0, 300) ?? null })
}

/** Obtém do cache ou da API. Em falha, devolve o último dado conhecido marcado como desatualizado. */
async function getForecast(admin: SupabaseClient, latRaw: number, lonRaw: number, force = false) {
  const lat = Number(round(latRaw).toFixed(2)), lon = Number(round(lonRaw).toFixed(2))
  const { data: cached } = await admin.from('weather_cache').select('*').eq('provider', PROVIDER).eq('lat', lat).eq('lon', lon).maybeSingle()
  // Atualização forçada respeita intervalo mínimo de 10 min (evita abuso da API pública)
  const recent = cached && Date.now() - new Date(cached.fetched_at).getTime() < 10 * 60_000
  if (cached && (!force || recent) && new Date(cached.valid_until) > new Date() && cached.status === 'ok') {
    await log(admin, 'cache_hit', Date.now())
    return { row: cached, stale: false, fromCache: true }
  }
  const started = Date.now()
  try {
    const { data, url } = await fetchOpenMeteo(lat, lon)
    const fetched_at = new Date().toISOString()
    const valid_until = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString()
    const { data: row, error } = await admin.from('weather_cache')
      .upsert({ provider: PROVIDER, lat, lon, payload: data, source_url: url, fetched_at, valid_until, status: 'ok', last_error: null, last_error_at: null }, { onConflict: 'provider,lat,lon' })
      .select('*').single()
    if (error) throw error
    await log(admin, 'ok', started, 200)
    return { row, stale: false, fromCache: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await log(admin, 'error', started, undefined, msg)
    if (cached) {
      await admin.from('weather_cache').update({ last_error: msg.slice(0, 300), last_error_at: new Date().toISOString() }).eq('id', cached.id)
      return { row: cached, stale: true, fromCache: true, error: msg }
    }
    return { row: null, stale: true, fromCache: false, error: msg }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const body = await req.json().catch(() => ({}))

  // Modo agendado: atualiza todas as propriedades com regras de alerta ativas
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret) {
    const { data: ok } = await admin.rpc('verify_cron_secret', { p_secret: cronSecret })
    if (!ok) return json(req, { error: 'Não autorizado' }, 401)
    const { data: farms } = await admin.rpc('farms_with_weather_rules')
    let alerts = 0, fetched = 0
    for (const f of (farms ?? []) as { farm_id: string; latitude: number; longitude: number }[]) {
      const r = await getForecast(admin, Number(f.latitude), Number(f.longitude))
      if (r.row && !r.stale) {
        fetched++
        const { data: n } = await admin.rpc('evaluate_weather_rules', { p_farm: f.farm_id, p_cache: r.row.id })
        alerts += Number(n ?? 0)
      }
    }
    return json(req, { ok: true, farms: farms?.length ?? 0, fetched, alerts })
  }

  // Modo usuário: autenticação obrigatória e acesso à propriedade verificado por RLS
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json(req, { error: 'Não autenticado' }, 401)
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: userData, error: userErr } = await userClient.auth.getUser(auth.slice(7))
  if (userErr || !userData.user) return json(req, { error: 'Sessão inválida' }, 401)

  const farmId = typeof body.farm_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.farm_id) ? body.farm_id : null
  if (!farmId) return json(req, { error: 'farm_id inválido' }, 400)
  const { data: farm, error: farmErr } = await userClient.from('farms').select('id, name, latitude, longitude').eq('id', farmId).maybeSingle()
  if (farmErr || !farm) return json(req, { error: 'Propriedade não encontrada ou sem acesso' }, 404)
  if (farm.latitude === null || farm.longitude === null) {
    return json(req, { status: 'unavailable', reason: 'no_coordinates', message: 'Cadastre as coordenadas da sede ou desenhe o limite da propriedade para obter a previsão.' }, 200)
  }

  const r = await getForecast(admin, Number(farm.latitude), Number(farm.longitude), body.force === true)
  if (!r.row) {
    return json(req, { status: 'unavailable', reason: 'provider_error', message: 'A fonte de previsão está indisponível no momento e não há dados anteriores armazenados.' }, 200)
  }
  let alerts = 0
  if (!r.stale) {
    const { data: n } = await admin.rpc('evaluate_weather_rules', { p_farm: farm.id, p_cache: r.row.id })
    alerts = Number(n ?? 0)
  }
  return json(req, {
    status: r.stale ? 'stale' : 'ok',
    data_kind: 'forecast',
    provider: 'Open-Meteo',
    provider_url: 'https://open-meteo.com/',
    license: 'Dados meteorológicos por Open-Meteo.com (CC BY 4.0). Uso gratuito destinado a fins não comerciais.',
    fetched_at: r.row.fetched_at,
    valid_until: r.row.valid_until,
    last_error_at: r.row.last_error_at,
    grid: { lat: r.row.lat, lon: r.row.lon },
    farm: { id: farm.id, name: farm.name, lat: farm.latitude, lon: farm.longitude },
    alerts_created: alerts,
    data: r.row.payload,
  })
})
