// AgroCentral — Edge Function "geocode"
// Geocodificação pontual via Nominatim/OSM respeitando a política de uso:
// máx. 1 req/s (controle global no banco), identificação via User-Agent, cache e atribuição.
// Não deve ser usada como autocomplete.
import { createClient } from 'jsr:@supabase/supabase-js@2'

function cors(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json(req, { error: 'Não autenticado' }, 401)
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data: u, error: ue } = await userClient.auth.getUser(auth.slice(7))
  if (ue || !u.user) return json(req, { error: 'Sessão inválida' }, 401)

  const body = await req.json().catch(() => ({}))
  const q = typeof body.q === 'string' ? body.q.trim().replace(/\s+/g, ' ') : ''
  if (q.length < 3 || q.length > 200) return json(req, { error: 'Consulta deve ter entre 3 e 200 caracteres' }, 400)
  const norm = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: cached } = await admin.from('geocode_cache').select('results, fetched_at').eq('query_norm', norm).maybeSingle()
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 30 * 86400_000) {
    return json(req, { results: (cached.results as unknown[]).map((r) => ({ ...(r as object), cached: true })), attribution: '© OpenStreetMap contributors (Nominatim)' })
  }

  // Aguarda uma vaga de 1 req/s (até ~3 s)
  let slot = false
  for (let i = 0; i < 6 && !slot; i++) {
    const { data } = await admin.rpc('take_rate_slot', { p_key: 'nominatim', p_interval_ms: 1100 })
    slot = data === true
    if (!slot) await sleep(550)
  }
  if (!slot) return json(req, { error: 'Serviço de geocodificação ocupado. Tente novamente em alguns segundos.' }, 429)

  const started = Date.now()
  try {
    const params = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'br', limit: '5', 'accept-language': 'pt-BR' })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'AgroCentral/0.1 (plataforma de gestao rural; geocodificacao pontual)', Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[]
    const results = rows.map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), label: r.display_name, source: 'Nominatim/OpenStreetMap', cached: false }))
    await admin.from('geocode_cache').upsert({ query_norm: norm, results, provider: 'nominatim', fetched_at: new Date().toISOString() })
    await admin.from('integration_logs').insert({ provider: 'nominatim', endpoint: '/search', status: 'ok', http_status: 200, duration_ms: Date.now() - started })
    return json(req, { results, attribution: '© OpenStreetMap contributors (Nominatim)' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin.from('integration_logs').insert({ provider: 'nominatim', endpoint: '/search', status: 'error', duration_ms: Date.now() - started, error: msg.slice(0, 300) })
    return json(req, { error: 'Geocodificação indisponível no momento.' }, 502)
  }
})
