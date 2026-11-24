// AgroCentral — Edge Function "market-sync"
// Adaptador de câmbio oficial: Banco Central do Brasil — SGS (séries diárias).
// Insere cotações com fonte, data de referência, horário de coleta e status "oficial".
// Limita chamadas: só consulta a API se a última coleta tiver mais de 30 minutos.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const MIN_INTERVAL_MIN = 30

function cors(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })

interface Instrument { id: string; name: string; unit: string; currency: string; provider: string | null; provider_series: string | null }

/** "dd/mm/aaaa" -> ISO às 13:00 de Brasília (horário de referência PTAX) */
function brDateToIso(d: string) {
  const [dd, mm, yyyy] = d.split('/')
  return `${yyyy}-${mm}-${dd}T16:00:00.000Z`
}

const brDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`

/** Primeira coleta: histórico de 1 ano por intervalo de datas; depois, apenas os últimos 20 valores (limite da API). */
async function fetchSgs(series: string, full: boolean) {
  const base = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${encodeURIComponent(series)}/dados`
  const now = new Date()
  const url = full
    ? `${base}?formato=json&dataInicial=${brDate(new Date(now.getTime() - 365 * 86400000))}&dataFinal=${brDate(now)}`
    : `${base}/ultimos/20?formato=json`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15_000)
  const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': 'AgroCentral/0.1' } }).finally(() => clearTimeout(t))
  if (!res.ok) throw new Error(`BCB SGS ${series} HTTP ${res.status}`)
  const rows = (await res.json()) as { data: string; valor: string }[]
  if (!Array.isArray(rows)) throw new Error('Resposta inesperada do BCB')
  return { url, rows }
}

async function sync(admin: SupabaseClient, force: boolean) {
  const { data: last } = await admin.from('market_quotes').select('fetched_at').is('organization_id', null).order('fetched_at', { ascending: false }).limit(1).maybeSingle()
  if (!force && last && Date.now() - new Date(last.fetched_at).getTime() < MIN_INTERVAL_MIN * 60_000) {
    return { skipped: true, inserted: 0, errors: [] as string[] }
  }
  const { data: instruments } = await admin.from('market_instruments').select('*').eq('provider', 'bcb_sgs')
  let inserted = 0
  const errors: string[] = []
  const fetched_at = new Date().toISOString()
  for (const inst of (instruments ?? []) as Instrument[]) {
    const started = Date.now()
    try {
      const { count } = await admin.from('market_quotes').select('id', { count: 'exact', head: true }).eq('instrument_id', inst.id).is('organization_id', null)
      const { url, rows } = await fetchSgs(inst.provider_series!, !count || count < 30)
      const payload = rows
        .map((r) => ({ v: Number(String(r.valor).replace(',', '.')), r }))
        .filter((x) => Number.isFinite(x.v) && x.v > 0)
        .map(({ v, r }) => ({
          instrument_id: inst.id, value: v, currency: inst.currency, unit: inst.unit, region: 'Brasil',
          source: `Banco Central do Brasil — SGS ${inst.provider_series}`, source_url: url,
          observed_at: brDateToIso(r.data), fetched_at, status: 'oficial', payload: r,
        }))
      const { data: n, error } = await admin.rpc('upsert_official_quotes', { p_rows: payload })
      if (error) throw error
      inserted += Number(n ?? 0)
      await admin.from('integration_logs').insert({ provider: 'bcb_sgs', endpoint: `sgs.${inst.provider_series}`, status: 'ok', http_status: 200, duration_ms: Date.now() - started })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${inst.id}: ${msg}`)
      await admin.from('integration_logs').insert({ provider: 'bcb_sgs', endpoint: `sgs.${inst.provider_series}`, status: 'error', duration_ms: Date.now() - started, error: msg.slice(0, 300) })
    }
  }
  return { skipped: false, inserted, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret) {
    const { data: ok } = await admin.rpc('verify_cron_secret', { p_secret: cronSecret })
    if (!ok) return json(req, { error: 'Não autorizado' }, 401)
    return json(req, await sync(admin, true))
  }
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json(req, { error: 'Não autenticado' }, 401)
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data: u, error } = await userClient.auth.getUser(auth.slice(7))
  if (error || !u.user) return json(req, { error: 'Sessão inválida' }, 401)
  return json(req, await sync(admin, false))
})
