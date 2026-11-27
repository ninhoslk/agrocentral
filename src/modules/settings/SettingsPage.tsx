import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FlaskConical, Mail, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { ROLE_LABELS, useCurrentOrg, type Role } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Checkbox, FieldWrap, Input, Select, Tabs } from '@/components/ui/primitives'
import { Dialog, useConfirm } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { UFS } from '@/services/providers/ibge'
import { formatDate, formatDateTime } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'
import { CATEGORIES } from '@/modules/notifications/NotificationsPage'

type Tab = 'perfil' | 'organizacao' | 'usuarios' | 'preferencias' | 'alertas' | 'plano' | 'auditoria'
const MODULES = [
  { id: 'farms', label: 'Propriedades, mapa, talhões e safras' }, { id: 'activities', label: 'Diário de campo' }, { id: 'tasks', label: 'Tarefas' },
  { id: 'team', label: 'Equipe' }, { id: 'finance', label: 'Financeiro' }, { id: 'budget', label: 'Orçamento' }, { id: 'inventory', label: 'Estoque' }, { id: 'equipment', label: 'Máquinas' },
  { id: 'documents', label: 'Documentos' }, { id: 'weather', label: 'Clima e alertas' }, { id: 'market', label: 'Mercado e câmbio' }, { id: 'marketplace', label: 'Marketplace' },
]
const ROLE_DESC: Record<Role, string> = {
  owner: 'Acesso total, inclusive proprietários.', admin: 'Administra conta, usuários e todos os módulos.', manager: 'Gestão operacional; financeiro somente leitura.',
  agronomist: 'Talhões, safras, atividades, tarefas e documentos técnicos.', finance: 'Financeiro completo; demais módulos em leitura.',
  operator: 'Registra atividades e atualiza tarefas atribuídas.', viewer: 'Somente consulta.',
}

export function SettingsPage() {
  const { tab = 'perfil' } = useParams()
  const navigate = useNavigate()
  const { can } = useCurrentOrg()
  const isAdmin = can('settings', 'admin')
  const items: { value: Tab; label: string }[] = [
    { value: 'perfil', label: 'Perfil' }, { value: 'organizacao', label: 'Organização' }, { value: 'usuarios', label: 'Usuários e permissões' },
    { value: 'preferencias', label: 'Preferências' }, { value: 'alertas', label: 'Alertas' }, { value: 'plano', label: 'Plano' },
    ...(isAdmin ? [{ value: 'auditoria' as Tab, label: 'Auditoria' }] : []),
  ]
  return (
    <>
      <PageHeader title="Configurações" crumbs={[{ label: 'Configurações' }]} />
      <Tabs value={tab as Tab} onChange={(t) => navigate(`/configuracoes/${t}`)} className="mb-5" items={items} />
      {tab === 'perfil' && <ProfileTab />}
      {tab === 'organizacao' && <OrgTab />}
      {tab === 'usuarios' && <UsersTab />}
      {tab === 'preferencias' && <PrefsTab />}
      {tab === 'alertas' && <AlertsTab />}
      {tab === 'plano' && <PlanTab />}
      {tab === 'auditoria' && isAdmin && <AuditTab />}
    </>
  )
}

function ProfileTab() {
  const { user } = useAuth()
  const { refresh } = useCurrentOrg()
  const q = useQuery({ queryKey: ['profile-full', user?.id], queryFn: () => unwrap(supabase.from('profiles').select('*').eq('id', user!.id).single()) })
  const [f, setF] = useState({ full_name: '', phone: '' })
  useEffect(() => { if (q.data) setF({ full_name: q.data.full_name ?? '', phone: q.data.phone ?? '' }) }, [q.data])
  const save = useAppMutation(async () => unwrap(supabase.from('profiles').update({ full_name: f.full_name.trim() || null, phone: f.phone.trim() || null }).eq('id', user!.id)), { success: 'Perfil atualizado', onSuccess: refresh })
  const [pwd, setPwd] = useState('')
  const changePwd = async () => {
    if (pwd.length < 10 || !/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) { toast.error('Senha: mínimo 10 caracteres, com letras e números'); return }
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) toast.error(toUserMessage(error)); else { toast.success('Senha alterada'); setPwd('') }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Dados pessoais" />
        <div className="space-y-4 p-5">
          <FieldWrap label="E-mail" htmlFor="p-email"><Input id="p-email" value={user?.email ?? ''} disabled /></FieldWrap>
          <FieldWrap label="Nome completo" htmlFor="p-name"><Input id="p-name" maxLength={120} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></FieldWrap>
          <FieldWrap label="Telefone" htmlFor="p-phone"><Input id="p-phone" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></FieldWrap>
          <Button onClick={() => save.mutate()} loading={save.isPending}>Salvar</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Segurança" />
        <div className="space-y-4 p-5">
          <FieldWrap label="Nova senha" htmlFor="p-pwd" hint="Mínimo de 10 caracteres, com letras e números."><Input id="p-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></FieldWrap>
          <Button variant="outline" onClick={() => void changePwd()}>Alterar senha</Button>
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm text-muted">Encerra a sessão em todos os dispositivos.</p>
            <Button variant="outline" onClick={() => void supabase.auth.signOut({ scope: 'global' })}>Sair de todos os dispositivos</Button>
          </div>
          <p className="text-xs text-muted">Último acesso: {formatDateTime(user?.last_sign_in_at)}</p>
        </div>
      </Card>
    </div>
  )
}

function OrgTab() {
  const { org, can, refresh } = useCurrentOrg()
  const qc = useQueryClient()
  const { confirm, node } = useConfirm()
  const isAdmin = can('settings', 'admin')
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const full = useQuery({ queryKey: ['org-full', org.id], queryFn: () => unwrap(supabase.from('organizations').select('*').eq('id', org.id).single()) })
  const demoCount = useQuery({ queryKey: ['demo-count', org.id], queryFn: async () => { const { count } = await supabase.from('farms').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('is_demo', true); return count ?? 0 } })
  const update = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('organizations').update(v as never).eq('id', org.id)), { invalidate: [['org-full'], ['my-orgs'], ['perms']], onSuccess: refresh })
  const toggleModule = (m: string, on: boolean) => {
    const cur = full.data?.enabled_modules ?? []
    const next = on ? [...new Set([...cur, m])] : cur.filter((x) => x !== m)
    if (m === 'farms' && !on) next.splice(0, next.length, ...next.filter((x) => !['fields', 'seasons'].includes(x)))
    update.mutate({ enabled_modules: next })
  }
  const demo = async (action: 'seed' | 'clear') => {
    if (action === 'clear' && !(await confirm('Remover dados demonstrativos?', 'Todos os registros marcados como DADO DEMONSTRATIVO serão excluídos. Seus dados reais não são afetados.', 'Remover'))) return
    setBusy(true)
    const { error } = action === 'seed' ? await supabase.rpc('seed_demo_data', { p_org: org.id }) : await supabase.rpc('clear_demo_data', { p_org: org.id })
    setBusy(false)
    if (error) { toast.error(toUserMessage(error)); return }
    toast.success(action === 'seed' ? 'Dados demonstrativos criados' : 'Dados demonstrativos removidos')
    refresh(); await qc.invalidateQueries()
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Dados da organização" actions={isAdmin && <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Editar</Button>} />
        <dl className="grid grid-cols-2 gap-3 p-5 text-sm">
          <div><dt className="text-xs text-muted">Nome</dt><dd className="font-medium">{full.data?.name}</dd></div>
          <div><dt className="text-xs text-muted">CPF/CNPJ</dt><dd>{full.data?.legal_document ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">Município/UF</dt><dd>{full.data?.city ? `${full.data.city}/${full.data.state}` : '—'}</dd></div>
          <div><dt className="text-xs text-muted">Cultura principal</dt><dd>{full.data?.main_crop ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">Seu papel</dt><dd><Badge tone="brand">{ROLE_LABELS[org.role]}</Badge></dd></div>
          <div><dt className="text-xs text-muted">Criada em</dt><dd>{formatDate(full.data?.created_at)}</dd></div>
        </dl>
      </Card>
      <Card>
        <CardHeader title="Módulos" description="Ative ou desative áreas da plataforma para toda a organização. Dados não são apagados ao desativar." />
        <ul className="grid gap-2 p-5 sm:grid-cols-2">
          {MODULES.map((m) => <li key={m.id}><Checkbox label={m.label} disabled={!isAdmin || update.isPending} checked={full.data?.enabled_modules.includes(m.id) ?? false} onChange={(e) => toggleModule(m.id, e.target.checked)} /></li>)}
        </ul>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Dados demonstrativos" description="Uma fazenda fictícia completa e coerente entre todos os módulos, sempre marcada como DADO DEMONSTRATIVO." />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <FlaskConical className="h-5 w-5 text-orange-600" />
          <span className="text-sm">{demoCount.data ? 'Esta organização possui dados demonstrativos.' : 'Nenhum dado demonstrativo.'}</span>
          {isAdmin && (demoCount.data
            ? <Button variant="outline" loading={busy} onClick={() => void demo('clear')}><Trash2 className="h-4 w-4" />Remover dados demonstrativos</Button>
            : <Button variant="outline" loading={busy} onClick={() => void demo('seed')}>Gerar dados demonstrativos</Button>)}
        </div>
      </Card>
      <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} title="Editar organização" initial={full.data} size="md"
        fields={[
          { name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 120, span: 3 },
          { name: 'legal_document', label: 'CPF/CNPJ', type: 'text', maxLength: 20, span: 2 },
          { name: 'main_crop', label: 'Cultura principal', type: 'text', maxLength: 60, span: 1 },
          { name: 'city', label: 'Município', type: 'text', maxLength: 120, span: 2 },
          { name: 'state', label: 'UF', type: 'select', options: UFS.map((u) => ({ value: u, label: u })), span: 1 },
        ]} onSubmit={(v) => update.mutateAsync(v)} />
      {node}
    </div>
  )
}

function UsersTab() {
  const { orgId, can, farms } = useCurrentOrg()
  const { user } = useAuth()
  const isAdmin = can('settings', 'admin')
  const { confirm, node } = useConfirm()
  const [invite, setInvite] = useState(false)
  const [edit, setEdit] = useState<{ membership_id: string; role: Role; all_farms: boolean; farm_ids: string[]; status: string; name: string } | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => unwrap(supabase.rpc('list_members', { p_org: orgId })) })
  const invites = useQuery({ queryKey: ['invitations', orgId], enabled: isAdmin, queryFn: () => unwrap(supabase.from('invitations').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })) })
  const revoke = useAppMutation(async (id: string) => unwrap(supabase.from('invitations').update({ status: 'revoked' }).eq('id', id)), { invalidate: [['invitations']], success: 'Convite revogado' })
  const saveAccess = useAppMutation(async () => unwrap(supabase.rpc('set_member_access', { p_membership: edit!.membership_id, p_role: edit!.role, p_all_farms: edit!.all_farms, p_farm_ids: edit!.farm_ids, p_status: edit!.status })),
    { invalidate: [['members']], success: 'Acesso atualizado', onSuccess: () => setEdit(null) })
  const removeMember = useAppMutation(async (id: string) => unwrap(supabase.from('memberships').delete().eq('id', id)), { invalidate: [['members']], success: 'Usuário removido da organização' })

  const [inv, setInv] = useState({ email: '', role: 'viewer' as Role, all_farms: true, farm_ids: [] as string[] })
  const [sending, setSending] = useState(false)
  const sendInvite = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inv.email.trim())) { toast.error('E-mail inválido'); return }
    if (!inv.all_farms && !inv.farm_ids.length) { toast.error('Selecione ao menos uma propriedade'); return }
    setSending(true)
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; email_sent: boolean; link: string; reason?: string; error?: string }>('send-invite', {
      body: { organization_id: orgId, email: inv.email.trim(), role: inv.role, all_farms: inv.all_farms, farm_ids: inv.farm_ids, origin: window.location.origin },
    })
    setSending(false)
    if (error || !data?.ok) {
      let msg = toUserMessage(error)
      try { const ctx = (error as { context?: Response })?.context; if (ctx) msg = (await ctx.json()).error ?? msg } catch { /* */ }
      toast.error(msg); return
    }
    setInvite(false); setInv({ email: '', role: 'viewer', all_farms: true, farm_ids: [] })
    void invites.refetch()
    if (data.email_sent) toast.success('Convite enviado por e-mail')
    setLink(data.link)
  }

  type M = NonNullable<typeof members.data>[number]
  const cols: Column<M>[] = [
    { key: 'name', header: 'Usuário', primary: true, value: (r) => r.full_name ?? r.email, cell: (r) => <span><span className="font-medium">{r.full_name ?? '—'}</span>{r.user_id === user?.id && <Badge className="ml-1">você</Badge>}<span className="block text-xs text-muted">{r.email}</span></span> },
    { key: 'role', header: 'Papel', value: (r) => ROLE_LABELS[r.role as Role], cell: (r) => <Badge tone="brand">{ROLE_LABELS[r.role as Role]}</Badge> },
    { key: 'farms', header: 'Propriedades', value: (r) => (r.all_farms ? 'Todas' : r.farm_ids.length), cell: (r) => (r.all_farms ? 'Todas' : farms.filter((f) => r.farm_ids.includes(f.id)).map((f) => f.name).join(', ') || 'Nenhuma') },
    { key: 'status', header: 'Situação', value: (r) => r.status, cell: (r) => <Badge tone={r.status === 'active' ? 'green' : 'yellow'}>{r.status === 'active' ? 'Ativo' : 'Suspenso'}</Badge> },
    { key: 'since', header: 'Desde', value: (r) => r.created_at, cell: (r) => formatDate(r.created_at) },
    { key: 'act', header: '', align: 'right', cell: (r) => isAdmin && r.user_id !== user?.id ? (
      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" onClick={() => setEdit({ membership_id: r.membership_id, role: r.role as Role, all_farms: r.all_farms, farm_ids: r.farm_ids, status: r.status, name: r.full_name ?? r.email ?? '' })}>Editar acesso</Button>
        <Button variant="ghost" size="sm" className="text-danger" onClick={async () => { if (await confirm('Remover usuário?', `${r.full_name ?? r.email} perderá acesso imediatamente à organização.`, 'Remover')) removeMember.mutate(r.membership_id) }}>Remover</Button>
      </span>) : null },
  ]
  return (
    <div className="space-y-5">
      <DataTable rows={members.data} columns={cols} loading={members.isLoading} error={members.error} rowKey={(r) => r.membership_id}
        toolbar={isAdmin ? <Button size="sm" onClick={() => setInvite(true)}><UserPlus className="h-4 w-4" />Convidar</Button> : undefined} />
      {isAdmin && (
        <Card>
          <CardHeader title="Convites" />
          <ul className="divide-y divide-line">
            {(invites.data ?? []).map((i) => {
              const expired = i.status === 'pending' && new Date(i.expires_at) < new Date()
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span><Mail className="mr-1 inline h-4 w-4 text-muted" />{i.email} · {ROLE_LABELS[i.role as Role]} <Badge tone={i.status === 'accepted' ? 'green' : i.status === 'pending' && !expired ? 'blue' : 'neutral'}>{expired ? 'expirado' : i.status === 'pending' ? 'pendente' : i.status === 'accepted' ? 'aceito' : i.status}</Badge></span>
                  <span className="flex gap-1">
                    {i.status === 'pending' && !expired && <Button variant="ghost" size="sm" onClick={() => setLink(`${window.location.origin}/convite/${i.token}`)}><Copy className="h-4 w-4" />Link</Button>}
                    {i.status === 'pending' && <Button variant="ghost" size="sm" className="text-danger" onClick={() => revoke.mutate(i.id)}>Revogar</Button>}
                  </span>
                </li>
              )
            })}
            {!invites.data?.length && <li className="px-5 py-6 text-center text-sm text-muted">Nenhum convite enviado.</li>}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="Papéis e permissões" description="Permissões aplicadas no banco de dados (RLS) por módulo, propriedade e ação." />
        <ul className="grid gap-2 p-5 text-sm sm:grid-cols-2">{(Object.keys(ROLE_DESC) as Role[]).map((r) => <li key={r}><strong>{ROLE_LABELS[r]}:</strong> <span className="text-muted">{ROLE_DESC[r]}</span></li>)}</ul>
      </Card>

      <Dialog open={invite} onOpenChange={setInvite} title="Convidar colaborador" size="md"
        footer={<><Button variant="outline" onClick={() => setInvite(false)}>Cancelar</Button><Button loading={sending} onClick={() => void sendInvite()}>Enviar convite</Button></>}>
        <AccessForm email={inv.email} onEmail={(e) => setInv({ ...inv, email: e })} role={inv.role} onRole={(r) => setInv({ ...inv, role: r })}
          allFarms={inv.all_farms} onAll={(a) => setInv({ ...inv, all_farms: a })} farmIds={inv.farm_ids} onFarms={(f) => setInv({ ...inv, farm_ids: f })} />
      </Dialog>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Acesso de ${edit?.name ?? ''}`} size="md"
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button loading={saveAccess.isPending} onClick={() => saveAccess.mutate()}>Salvar</Button></>}>
        {edit && <>
          <AccessForm role={edit.role} onRole={(r) => setEdit({ ...edit, role: r })} allFarms={edit.all_farms} onAll={(a) => setEdit({ ...edit, all_farms: a })} farmIds={edit.farm_ids} onFarms={(f) => setEdit({ ...edit, farm_ids: f })} allowOwner={can('settings', 'admin')} />
          <FieldWrap label="Situação" htmlFor="m-status" className="mt-4"><Select id="m-status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Ativo</option><option value="suspended">Suspenso</option></Select></FieldWrap>
        </>}
      </Dialog>
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)} title="Link do convite" size="md">
        <p className="mb-3 text-sm text-muted">Compartilhe este link com a pessoa convidada. Ela deve entrar (ou criar conta) com o e-mail do convite. Válido por 7 dias.</p>
        <div className="flex gap-2"><Input readOnly value={link ?? ''} onFocus={(e) => e.target.select()} aria-label="Link do convite" /><Button onClick={() => { void navigator.clipboard.writeText(link ?? ''); toast.success('Link copiado') }}><Copy className="h-4 w-4" />Copiar</Button></div>
      </Dialog>
      {node}
    </div>
  )
}

function AccessForm({ email, onEmail, role, onRole, allFarms, onAll, farmIds, onFarms, allowOwner }: {
  email?: string; onEmail?: (v: string) => void; role: Role; onRole: (r: Role) => void; allFarms: boolean; onAll: (a: boolean) => void
  farmIds: string[]; onFarms: (f: string[]) => void; allowOwner?: boolean
}) {
  const { farms, org } = useCurrentOrg()
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'owner' || (allowOwner && org.role === 'owner' && !onEmail))
  return (
    <div className="space-y-4">
      {onEmail && <FieldWrap label="E-mail" htmlFor="inv-email" required><Input id="inv-email" type="email" value={email} onChange={(e) => onEmail(e.target.value)} /></FieldWrap>}
      <FieldWrap label="Papel" htmlFor="inv-role" hint={ROLE_DESC[role]}><Select id="inv-role" value={role} onChange={(e) => onRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select></FieldWrap>
      <Checkbox label="Acesso a todas as propriedades (inclusive futuras)" checked={allFarms} onChange={(e) => onAll(e.target.checked)} />
      {!allFarms && (
        <ul className="space-y-1 rounded-lg border border-line p-3">
          {farms.map((f) => <li key={f.id}><Checkbox label={f.name} checked={farmIds.includes(f.id)} onChange={(e) => onFarms(e.target.checked ? [...farmIds, f.id] : farmIds.filter((x) => x !== f.id))} /></li>)}
        </ul>
      )}
    </div>
  )
}

function PrefsTab() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['prefs', user?.id], queryFn: () => unwrap(supabase.from('user_preferences').select('*').eq('user_id', user!.id).maybeSingle()) })
  const inst = useQuery({ queryKey: ['market-instruments'], queryFn: () => unwrap(supabase.from('market_instruments').select('id, name').order('sort')) })
  const units = (q.data?.units ?? { area: 'ha', weight: 'sc' }) as { area: string; weight: string }
  const favs = q.data?.favorite_instruments ?? ['USD_BRL', 'SOJA', 'MILHO']
  const save = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('user_preferences').upsert({ user_id: user!.id, ...patch } as never, { onConflict: 'user_id' })
    if (error) toast.error(toUserMessage(error)); else { toast.success('Preferências salvas'); qc.invalidateQueries({ queryKey: ['prefs'] }) }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Unidades preferidas" description="Usadas como padrão em calculadoras e exibição. Conversões sempre explícitas." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FieldWrap label="Área" htmlFor="u-area"><Select id="u-area" value={units.area} onChange={(e) => void save({ units: { ...units, area: e.target.value } })}><option value="ha">Hectare</option><option value="alq_paulista">Alqueire paulista</option><option value="alq_mineiro">Alqueire mineiro</option></Select></FieldWrap>
          <FieldWrap label="Produção" htmlFor="u-weight"><Select id="u-weight" value={units.weight} onChange={(e) => void save({ units: { ...units, weight: e.target.value } })}><option value="sc">Sacas</option><option value="t">Toneladas</option><option value="kg">Quilos</option></Select></FieldWrap>
        </div>
      </Card>
      <Card>
        <CardHeader title="Cotações favoritas" description="Aparecem no dashboard e em destaque no Mercado." />
        <ul className="grid gap-2 p-5 sm:grid-cols-2">
          {(inst.data ?? []).map((i) => <li key={i.id}><Checkbox label={i.name} checked={favs.includes(i.id)} onChange={(e) => void save({ favorite_instruments: e.target.checked ? [...favs, i.id] : favs.filter((f) => f !== i.id) })} /></li>)}
        </ul>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Dashboard" />
        <div className="flex flex-wrap items-center gap-3 p-5 text-sm">
          <span className="text-muted">Personalize widgets diretamente no painel.</span>
          <Link to="/"><Button variant="outline" size="sm">Abrir dashboard</Button></Link>
          <Button variant="ghost" size="sm" onClick={() => void save({ dashboard_layout: null })}>Restaurar layout padrão</Button>
        </div>
      </Card>
    </div>
  )
}

function AlertsTab() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notif-prefs', user?.id], queryFn: () => unwrap(supabase.from('notification_preferences').select('*').eq('user_id', user!.id)) })
  const get = (c: string) => q.data?.find((p) => p.category === c) ?? { in_app: true, email: false, min_priority: 'baixa', quiet_start: null, quiet_end: null }
  const save = async (category: string, patch: Record<string, unknown>) => {
    const cur = get(category)
    const { error } = await supabase.from('notification_preferences').upsert({ user_id: user!.id, category, in_app: cur.in_app, email: cur.email, min_priority: cur.min_priority, quiet_start: cur.quiet_start, quiet_end: cur.quiet_end, ...patch } as never, { onConflict: 'user_id,category' })
    if (error) toast.error(toUserMessage(error)); else qc.invalidateQueries({ queryKey: ['notif-prefs'] })
  }
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Preferências por categoria" description="Notificações internas são geradas no servidor, deduplicadas e registradas com horário de criação e leitura. E-mail e push serão habilitados após configuração de envio e consentimento." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface/70 text-left text-xs text-muted"><tr><th className="px-4 py-2">Categoria</th><th className="px-4 py-2">Na plataforma</th><th className="px-4 py-2">Prioridade mínima</th><th className="px-4 py-2">Horário de silêncio</th></tr></thead>
            <tbody className="divide-y divide-line">
              {CATEGORIES.map((c) => {
                const p = get(c.value)
                return (
                  <tr key={c.value}>
                    <td className="px-4 py-2 font-medium">{c.label}</td>
                    <td className="px-4 py-2"><Checkbox label={p.in_app ? 'Ativo' : 'Desativado'} checked={p.in_app} onChange={(e) => void save(c.value, { in_app: e.target.checked })} /></td>
                    <td className="px-4 py-2"><Select aria-label={`Prioridade mínima ${c.label}`} value={p.min_priority} onChange={(e) => void save(c.value, { min_priority: e.target.value })} className="h-10 w-32 sm:h-8"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></Select></td>
                    <td className="px-4 py-2"><span className="flex items-center gap-1"><Input aria-label="Início do silêncio" type="time" className="h-10 w-28 sm:h-8" value={p.quiet_start ?? ''} onChange={(e) => void save(c.value, { quiet_start: e.target.value || null })} />–<Input aria-label="Fim do silêncio" type="time" className="h-10 w-28 sm:h-8" value={p.quiet_end ?? ''} onChange={(e) => void save(c.value, { quiet_end: e.target.value || null })} /></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/clima"><Button variant="outline">Regras de alerta de clima</Button></Link>
        <Link to="/mercado"><Button variant="outline">Alertas de preço</Button></Link>
      </div>
    </div>
  )
}

function PlanTab() {
  const { org } = useCurrentOrg()
  return (
    <Card>
      <CardHeader title="Plano atual" />
      <div className="space-y-3 p-5 text-sm">
        <p>Plano: <Badge tone="brand">{org.plan}</Badge></p>
        <p className="text-muted">Durante a fase de demonstração/piloto todos os módulos estão disponíveis. Limites e preços dos planos (Gratuito, Essencial, Profissional, Avançado e Empresarial) ainda serão definidos com base em custos de infraestrutura e validação com produtores.</p>
      </div>
    </Card>
  )
}

function AuditTab() {
  const { orgId } = useCurrentOrg()
  const q = useQuery({ queryKey: ['audit', orgId], queryFn: () => unwrap(supabase.from('audit_logs').select('*').eq('organization_id', orgId).order('at', { ascending: false }).limit(300)) })
  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => unwrap(supabase.rpc('list_members', { p_org: orgId })) })
  const name = (id: string | null) => members.data?.find((m) => m.user_id === id)?.full_name ?? (id ? 'Usuário' : 'Sistema')
  type A = NonNullable<typeof q.data>[number]
  const diff = (a: A) => {
    if (a.action !== 'UPDATE' || !a.old_data || !a.new_data) return ''
    const o = a.old_data as Record<string, unknown>, n = a.new_data as Record<string, unknown>
    return Object.keys(n).filter((k) => !['updated_at', 'updated_by'].includes(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).join(', ')
  }
  const cols: Column<A>[] = [
    { key: 'at', header: 'Data', value: (r) => r.at, cell: (r) => formatDateTime(r.at) },
    { key: 'who', header: 'Usuário', value: (r) => name(r.actor), cell: (r) => name(r.actor) },
    { key: 'action', header: 'Ação', value: (r) => r.action, cell: (r) => <Badge tone={r.action === 'DELETE' ? 'red' : r.action === 'INSERT' ? 'green' : 'blue'}>{r.action === 'INSERT' ? 'Criação' : r.action === 'UPDATE' ? 'Alteração' : 'Exclusão'}</Badge> },
    { key: 'table', header: 'Registro', primary: true, value: (r) => r.table_name, cell: (r) => `${r.table_name}${(r.new_data as { name?: string; description?: string } | null)?.name ? ` · ${(r.new_data as { name: string }).name}` : (r.new_data as { description?: string } | null)?.description ? ` · ${(r.new_data as { description: string }).description}` : ''}` },
    { key: 'fields', header: 'Campos alterados', value: (r) => diff(r), cell: (r) => <span className="text-xs text-muted">{diff(r) || '—'}</span> },
  ]
  return <DataTable rows={q.data} columns={cols} loading={q.isLoading} error={q.error} exportName="Trilha de auditoria" rowKey={(r) => String(r.id)} />
}
