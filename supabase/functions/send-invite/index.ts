// AgroCentral — Edge Function "send-invite"
// Cria o convite (permissão verificada no banco pela RPC create_invitation, com o JWT do usuário)
// e envia e-mail de convite via Supabase Auth. Se o e-mail já tiver conta, devolve o link
// para o administrador compartilhar (o usuário entra e aceita o convite).
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

const ROLES = ['admin', 'manager', 'agronomist', 'finance', 'operator', 'viewer']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json(req, { error: 'Não autenticado' }, 401)

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = typeof body.role === 'string' && ROLES.includes(body.role) ? body.role : null
  const org = typeof body.organization_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.organization_id) ? body.organization_id : null
  const origin = typeof body.origin === 'string' && /^https?:\/\/[\w.-]+(:\d+)?$/.test(body.origin) ? body.origin : null
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !role || !org || !origin) return json(req, { error: 'Dados do convite inválidos' }, 400)
  const farmIds = Array.isArray(body.farm_ids) ? body.farm_ids.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x as string)) : []

  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: token, error } = await userClient.rpc('create_invitation', {
    p_org: org, p_email: email, p_role: role, p_all_farms: body.all_farms !== false, p_farm_ids: farmIds,
  })
  if (error) return json(req, { error: error.message, code: error.code }, error.code === '42501' ? 403 : 400)

  const link = `${origin}/convite/${token}`
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: link })
  if (inviteErr) {
    // Usuário já cadastrado (ou limite de envio): o administrador compartilha o link
    return json(req, { ok: true, email_sent: false, link, reason: /registered|exists/i.test(inviteErr.message) ? 'existing_user' : 'email_failed' })
  }
  return json(req, { ok: true, email_sent: true, link })
})
