import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as RDialog from '@radix-ui/react-dialog'
import {
  Banknote, Bell, BookOpen, Building2, ChevronsLeft, ChevronsRight, FilePlus2, LayoutDashboard, LineChart, ListChecks, ListPlus, LogOut, MessagesSquare, CloudSun, Boxes, Map as MapIcon, Menu,
  PiggyBank, Plus, Receipt, Search, Store, User, WifiOff, X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { NAV } from '@/app/router/nav'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOrg, ROLE_LABELS } from '@/app/providers/OrgProvider'
import { supabase } from '@/services/supabase/client'
import { Button, Select } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/overlay'
import { GlobalSearch } from './GlobalSearch'
import { Logo, LogoMark } from './Logo'

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

function useIsPlatformAdmin(uid?: string) {
  return useQuery({
    queryKey: ['platform-admin', uid],
    enabled: !!uid,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', uid!).maybeSingle()
      return !!data
    },
  })
}

function useVisibleNav() {
  const { can, moduleEnabled } = useOrg()
  const { user } = useAuth()
  const admin = useIsPlatformAdmin(user?.id)
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      if (it.module === '__platform_admin') return admin.data === true
      if (!it.module) return true
      if (it.module === 'marketplace') return moduleEnabled('marketplace')
      return moduleEnabled(it.module) && can(it.module, 'view')
    }),
  })).filter((g) => g.items.length)
}

function Sidebar({ collapsed, onNavigate, large }: { collapsed: boolean; onNavigate?: () => void; large?: boolean }) {
  const groups = useVisibleNav()
  return (
    <nav aria-label="Menu principal" className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-thin">
      {groups.map((g) => (
        <div key={g.label}>
          {!collapsed && <div className="px-2 pb-1 text-xs font-medium text-muted">{g.label}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to + it.label}>
                <NavLink
                  to={it.to}
                  end={it.to === '/' || it.to === '/marketplace'}
                  onClick={onNavigate}
                  title={collapsed ? it.label : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2.5 rounded-lg px-2 text-[14px] transition-colors',
                    large ? 'min-h-11' : 'min-h-8',
                    isActive ? 'bg-black/[0.06] font-medium text-ink' : 'text-muted hover:bg-black/[0.04] hover:text-ink',
                    collapsed && 'justify-center',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <it.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand-700' : '')} aria-hidden strokeWidth={1.75} />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                      {!collapsed && it.tag && <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-muted">{it.tag}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function useUnreadCount() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const unread = useQuery({
    queryKey: ['notif-unread', user?.id],
    enabled: !!user,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
        .is('read_at', null).is('archived_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['notif-unread'] })
        qc.invalidateQueries({ queryKey: ['notifications'] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [user, qc])
  return unread.data ?? 0
}

function NotificationBell({ n }: { n: number }) {
  return (
    <Link to="/notificacoes" className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-black/5 sm:h-9 sm:w-9"
      aria-label={n ? `Notificações: ${n} não lidas` : 'Notificações'}>
      <Bell className="h-5 w-5" strokeWidth={1.75} />
      {n > 0 && <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-[18px] text-white tabular">{n > 99 ? '99+' : n}</span>}
    </Link>
  )
}

function FarmSelector({ className }: { className?: string }) {
  const { farms, farmId, setFarmId } = useOrg()
  if (!farms.length) return null
  return (
    <Select aria-label="Propriedade selecionada" value={farmId ?? 'all'} onChange={(e) => setFarmId(e.target.value === 'all' ? null : e.target.value)}
      className={cn('h-10 min-w-0 truncate border-transparent bg-black/[0.04] text-[14px] sm:h-9 sm:max-w-[240px] sm:text-[13px]', className)}>
      <option value="all">Todas as propriedades</option>
      {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
    </Select>
  )
}

const QUICK = [
  { label: 'Registrar atividade', icon: BookOpen, to: '/diario?novo=1', module: 'activities' },
  { label: 'Adicionar despesa', icon: Receipt, to: '/financeiro?novo=despesa', module: 'finance' },
  { label: 'Orçar despesa', icon: PiggyBank, to: '/orcamento?aba=micro&novo=despesa', module: 'budget' },
  { label: 'Criar tarefa', icon: ListPlus, to: '/tarefas?novo=1', module: 'tasks' },
  { label: 'Anexar documento', icon: FilePlus2, to: '/documentos?novo=1', module: 'documents' },
  { label: 'Cadastrar anúncio', icon: Store, to: '/marketplace/novo', module: 'marketplace' },
]

/** Folha inferior do celular (menu completo ou ações rápidas) */
function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[950] bg-black/40" />
        <RDialog.Content className="fixed inset-x-0 bottom-0 z-[951] flex max-h-[88dvh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl focus:outline-none">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15" aria-hidden />
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <RDialog.Title className="text-base font-semibold">{title}</RDialog.Title>
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
            <RDialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar"><X className="h-5 w-5" /></Button></RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** Atalhos grandes no topo do menu do celular (os destinos mais usados, inclusive o marketplace) */
function MenuShortcuts({ onNavigate }: { onNavigate: () => void }) {
  const { can, moduleEnabled } = useOrg()
  const all = [
    { to: '/mapa', label: 'Mapa', icon: MapIcon, ok: moduleEnabled('farms') && can('farms') },
    { to: '/marketplace', label: 'Marketplace', icon: Store, ok: moduleEnabled('marketplace') },
    { to: '/marketplace/mensagens', label: 'Mensagens', icon: MessagesSquare, ok: moduleEnabled('marketplace') },
    { to: '/financeiro', label: 'Financeiro', icon: Banknote, ok: moduleEnabled('finance') && can('finance') },
    { to: '/orcamento', label: 'Orçamento', icon: PiggyBank, ok: moduleEnabled('budget') && can('budget') },
    { to: '/clima', label: 'Clima', icon: CloudSun, ok: moduleEnabled('weather') && can('weather') },
    { to: '/mercado', label: 'Mercado', icon: LineChart, ok: moduleEnabled('market') && can('market') },
    { to: '/diario', label: 'Diário', icon: BookOpen, ok: moduleEnabled('activities') && can('activities') },
    { to: '/tarefas', label: 'Tarefas', icon: ListChecks, ok: moduleEnabled('tasks') && can('tasks') },
    { to: '/estoque', label: 'Estoque', icon: Boxes, ok: moduleEnabled('inventory') && can('inventory') },
  ].filter((x) => x.ok).slice(0, 12)
  return (
    <ul className="grid grid-cols-4 gap-2 border-b border-line px-3 py-3" aria-label="Atalhos">
      {all.map((x) => (
        <li key={x.to}>
          <NavLink to={x.to} onClick={onNavigate} end={x.to === '/marketplace'}
            className={({ isActive }) => cn('flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl text-center text-[12px] font-medium active:bg-black/5', isActive ? 'bg-brand-50 text-brand-800' : 'bg-black/[0.03] text-ink')}>
            <x.icon className="h-6 w-6 text-brand-700" strokeWidth={1.75} aria-hidden />{x.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function BottomBar({ onMenu, onQuick }: { onMenu: () => void; onQuick: () => void }) {
  const { can, moduleEnabled } = useOrg()
  // Marketplace fica sempre a um toque no celular (quando o módulo está ativo)
  const fourth = moduleEnabled('marketplace')
    ? { to: '/marketplace', label: 'Marketplace', icon: Store }
    : moduleEnabled('finance') && can('finance')
      ? { to: '/financeiro', label: 'Financeiro', icon: Banknote }
      : { to: '/tarefas', label: 'Tarefas', icon: ListChecks }
  // Segundo atalho: orçamento (planejamento do dia a dia) quando disponível; senão o mapa
  const second = moduleEnabled('budget') && can('budget')
    ? { to: '/orcamento', label: 'Orçamento', icon: PiggyBank }
    : { to: '/mapa', label: 'Mapa', icon: MapIcon }
  const items = [
    { to: '/', label: 'Início', icon: LayoutDashboard },
    second,
    null,
    fourth,
  ]
  const tab = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium [-webkit-tap-highlight-color:transparent]'
  return (
    <nav aria-label="Navegação rápida" className="no-print fixed inset-x-0 bottom-0 z-[600] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-saturate-150 lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((it, i) => it === null ? (
          <li key="quick" className="flex flex-1 items-center justify-center">
            <button type="button" onClick={onQuick} aria-label="Registrar (ações rápidas)"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-800 text-white active:bg-brand-900 [-webkit-tap-highlight-color:transparent]">
              <Plus className="h-6 w-6" />
            </button>
          </li>
        ) : (
          <li key={i} className="flex flex-1">
            <NavLink to={it.to} end={it.to === '/'} className={({ isActive }) => cn(tab, 'min-w-0', isActive ? 'text-brand-800' : 'text-muted')}>
              <it.icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />{it.label}
            </NavLink>
          </li>
        ))}
        <li className="flex flex-1">
          <button type="button" onClick={onMenu} className={cn(tab, 'text-muted')}><Menu className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />Menu</button>
        </li>
      </ul>
    </nav>
  )
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth()
  const { org, orgs, setOrgId, profile, can, moduleEnabled } = useOrg()
  const online = useOnline()
  const navigate = useNavigate()
  const loc = useLocation()
  const unread = useUnreadCount()
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('agro.sidebar') === '1' } catch { return false } })
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => { setMenuOpen(false); setQuickOpen(false) }, [loc.pathname, loc.search])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('agro.sidebar', c ? '0' : '1') } catch { /* */ } return !c })

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const quick = QUICK.filter((q) => (q.module === 'marketplace' ? moduleEnabled('marketplace') : moduleEnabled(q.module) && can(q.module, 'create')))

  const accountItems = [
    { label: <span className="flex flex-col"><span className="font-medium">{name}</span><span className="text-xs text-muted">{org ? `${org.name} · ${ROLE_LABELS[org.role]}` : user?.email}</span></span>, onSelect: () => navigate('/configuracoes/perfil') },
    'separator' as const,
    { label: 'Perfil', icon: <User className="h-4 w-4" />, onSelect: () => navigate('/configuracoes/perfil') },
    { label: 'Organização', icon: <Building2 className="h-4 w-4" />, onSelect: () => navigate('/configuracoes/organizacao') },
    ...(orgs.length > 1 ? orgs.filter((o) => o.id !== org?.id).map((o) => ({ label: `Trocar para ${o.name}`, onSelect: () => setOrgId(o.id) })) : []),
    { label: 'Criar outra organização', icon: <Plus className="h-4 w-4" />, onSelect: () => navigate('/onboarding?nova=1') },
    'separator' as const,
    { label: 'Sair', icon: <LogOut className="h-4 w-4" />, danger: true, onSelect: () => { void signOut().then(() => navigate('/entrar')) } },
  ]

  return (
    <div className="flex min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:px-3 focus:py-2">Pular para o conteúdo</a>

      {/* Menu lateral (desktop): claro, recolhível */}
      <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-white transition-[width] lg:flex', collapsed ? 'w-[68px]' : 'w-60')}>
        <div className={cn('flex h-14 items-center px-4', collapsed && 'justify-center px-0')}>
          <Link to="/" aria-label="AgroCentral — início"><Logo compact={collapsed} dark /></Link>
        </div>
        {!collapsed && org && <div className="truncate px-5 pb-1 text-xs text-muted">{org.name}</div>}
        <Sidebar collapsed={collapsed} />
        <button type="button" onClick={toggleCollapsed} className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs text-muted hover:text-ink"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronsRight className="mx-auto h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher menu</>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[500] flex h-14 items-center gap-2 border-b border-line bg-white px-3 pt-[env(safe-area-inset-top)] sm:px-4">
          <Link to="/" aria-label="Início" className="shrink-0 lg:hidden"><LogoMark className="h-8 w-8" /></Link>
          {orgs.length > 1 && (
            <Select aria-label="Organização" value={org?.id} onChange={(e) => setOrgId(e.target.value)} className="hidden h-9 max-w-[200px] border-transparent bg-black/[0.04] text-[13px] md:block">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
          <FarmSelector className="flex-1 sm:flex-none" />
          <button type="button" onClick={() => setSearchOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-black/5 sm:ml-auto sm:h-9 sm:w-auto sm:min-w-[220px] sm:justify-start sm:gap-2 sm:bg-black/[0.04] sm:px-3 sm:text-sm"
            aria-label="Busca global">
            <Search className="h-5 w-5 sm:h-4 sm:w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Buscar…</span>
            <kbd className="ml-auto hidden rounded bg-white px-1.5 text-[10px] text-muted lg:inline">Ctrl K</kbd>
          </button>
          {quick.length > 0 && (
            <Dropdown
              trigger={<Button size="sm" className="hidden lg:inline-flex" aria-label="Ações rápidas"><Plus className="h-4 w-4" />Novo</Button>}
              items={quick.map((q) => ({ label: q.label, icon: <q.icon className="h-4 w-4" />, onSelect: () => navigate(q.to) }))}
            />
          )}
          <NotificationBell n={unread} />
          <Dropdown
            trigger={
              <button type="button" className="hidden h-9 items-center gap-2 rounded-lg px-1.5 hover:bg-black/5 sm:inline-flex" aria-label="Menu do perfil">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white">{name.slice(0, 1).toUpperCase()}</span>
              </button>
            }
            items={accountItems}
          />
        </header>

        {!online && (
          <div role="status" className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <WifiOff className="h-4 w-4 shrink-0" /> Sem conexão. Os dados podem estar desatualizados e alterações não serão salvas até a conexão voltar.
          </div>
        )}

        <main id="conteudo" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pb-8">
          {children ?? <Outlet />}
        </main>
        <footer className="no-print hidden border-t border-line px-6 py-3 text-center text-[11px] text-muted lg:block">
          AgroCentral · Sua fazenda, seus dados, suas decisões. · <Link to="/termos" className="underline">Termos</Link> · <Link to="/privacidade" className="underline">Privacidade</Link>
        </footer>
      </div>

      <BottomBar onMenu={() => setMenuOpen(true)} onQuick={() => setQuickOpen(true)} />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu">
        <div className="flex items-center gap-3 border-b border-line px-4 pb-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-800 text-sm font-semibold text-white">{name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted">{org ? `${org.name} · ${ROLE_LABELS[org.role]}` : user?.email}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void signOut().then(() => navigate('/entrar')) }}><LogOut className="h-4 w-4" />Sair</Button>
        </div>
        {orgs.length > 1 && (
          <div className="px-4 pt-3">
            <Select aria-label="Organização" value={org?.id} onChange={(e) => setOrgId(e.target.value)}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          </div>
        )}
        <MenuShortcuts onNavigate={() => setMenuOpen(false)} />
        <Sidebar collapsed={false} large onNavigate={() => setMenuOpen(false)} />
        <p className="px-5 pb-4 text-[11px] text-muted"><Link to="/termos" className="underline">Termos</Link> · <Link to="/privacidade" className="underline">Privacidade</Link></p>
      </Sheet>

      <Sheet open={quickOpen} onOpenChange={setQuickOpen} title="Registrar">
        <ul className="px-2 pb-3">
          {quick.map((q) => (
            <li key={q.to}>
              <button type="button" onClick={() => navigate(q.to)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] active:bg-black/5">
                <q.icon className="h-5 w-5 text-brand-700" strokeWidth={1.75} aria-hidden />{q.label}
              </button>
            </li>
          ))}
          {!quick.length && <li className="px-3 py-4 text-sm text-muted">Seu papel não permite criar registros.</li>}
        </ul>
      </Sheet>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
