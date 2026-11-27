import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useAuth } from './AuthProvider'

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'admin'
export type Role = 'owner' | 'admin' | 'manager' | 'agronomist' | 'finance' | 'operator' | 'viewer'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietário', admin: 'Administrador', manager: 'Gerente', agronomist: 'Agrônomo',
  finance: 'Financeiro', operator: 'Operador', viewer: 'Visualizador',
}

export interface OrgSummary {
  membershipId: string
  id: string
  name: string
  role: Role
  enabledModules: string[]
  plan: string
  city: string | null
  state: string | null
}

export interface FarmSummary {
  id: string
  name: string
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  is_demo: boolean
  total_area_ha: number | null
  productive_area_ha: number | null
}

interface OrgCtx {
  loading: boolean
  orgs: OrgSummary[]
  org: OrgSummary | null
  setOrgId: (id: string) => void
  farms: FarmSummary[]
  /** null = "Todas as propriedades" */
  farmId: string | null
  farm: FarmSummary | null
  setFarmId: (id: string | null) => void
  can: (module: string, action?: Action) => boolean
  moduleEnabled: (module: string) => boolean
  profile: { full_name: string | null; phone: string | null; onboarded_at: string | null } | null
  refresh: () => void
}

const Ctx = createContext<OrgCtx | null>(null)

const readLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const writeLS = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* indisponível */ } }

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id

  const profileQ = useQuery({
    queryKey: ['profile', uid],
    enabled: !!uid,
    queryFn: () => unwrap(supabase.from('profiles').select('full_name, phone, onboarded_at, last_organization_id').eq('id', uid!).maybeSingle()),
  })

  const orgsQ = useQuery({
    queryKey: ['my-orgs', uid],
    enabled: !!uid,
    queryFn: async () => {
      const rows = await unwrap(
        supabase.from('memberships')
          .select('id, role, status, organization_id, organizations(id, name, enabled_modules, plan, city, state)')
          .eq('user_id', uid!).eq('status', 'active'),
      )
      return rows
        .filter((r) => r.organizations)
        .map<OrgSummary>((r) => ({
          membershipId: r.id,
          id: r.organization_id,
          name: r.organizations!.name,
          role: r.role as Role,
          enabledModules: r.organizations!.enabled_modules,
          plan: r.organizations!.plan,
          city: r.organizations!.city,
          state: r.organizations!.state,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })

  const [orgId, setOrgIdState] = useState<string | null>(() => readLS('agro.org'))
  const orgs = useMemo(() => orgsQ.data ?? [], [orgsQ.data])
  const org = useMemo(() => {
    if (!orgs.length) return null
    return orgs.find((o) => o.id === orgId) ?? orgs.find((o) => o.id === profileQ.data?.last_organization_id) ?? orgs[0]
  }, [orgs, orgId, profileQ.data])

  const permsQ = useQuery({
    queryKey: ['perms', org?.id, uid],
    enabled: !!org?.id,
    queryFn: () => unwrap(supabase.rpc('my_permissions', { p_org: org!.id })),
  })

  const farmsQ = useQuery({
    queryKey: ['farms-lite', org?.id],
    enabled: !!org?.id,
    queryFn: () => unwrap(
      supabase.from('farms').select('id, name, city, state, latitude, longitude, is_demo, total_area_ha, productive_area_ha')
        .eq('organization_id', org!.id).is('archived_at', null).order('name'),
    ),
  })

  const prefsQ = useQuery({
    queryKey: ['prefs', uid],
    enabled: !!uid,
    queryFn: () => unwrap(supabase.from('user_preferences').select('*').eq('user_id', uid!).maybeSingle()),
  })

  const [farmIdState, setFarmIdState] = useState<string | null | undefined>(undefined)
  const farms = useMemo(() => (farmsQ.data ?? []) as FarmSummary[], [farmsQ.data])
  const farmId = useMemo(() => {
    const candidate = farmIdState !== undefined ? farmIdState : (readLS(`agro.farm.${org?.id}`) ?? prefsQ.data?.selected_farm_id ?? null)
    if (candidate === 'all' || candidate === null) return null
    return farms.some((f) => f.id === candidate) ? candidate : null
  }, [farmIdState, farms, org?.id, prefsQ.data])

  useEffect(() => { setFarmIdState(undefined) }, [org?.id])

  const setOrgId = useCallback((id: string) => {
    writeLS('agro.org', id)
    setOrgIdState(id)
    if (uid) void supabase.from('profiles').update({ last_organization_id: id }).eq('id', uid)
    qc.invalidateQueries()
  }, [qc, uid])

  const setFarmId = useCallback((id: string | null) => {
    setFarmIdState(id ?? 'all')
    writeLS(`agro.farm.${org?.id}`, id ?? 'all')
    if (uid) void supabase.from('user_preferences').upsert({ user_id: uid, selected_farm_id: id }, { onConflict: 'user_id' })
  }, [org?.id, uid])

  const permMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const p of permsQ.data ?? []) m.set(p.module, new Set(p.actions))
    return m
  }, [permsQ.data])

  const can = useCallback((module: string, action: Action = 'view') => permMap.get(module)?.has(action) ?? false, [permMap])
  const moduleEnabled = useCallback((module: string) => {
    if (!org) return false
    if (['dashboard', 'notifications', 'reports', 'settings'].includes(module)) return true
    return org.enabledModules.includes(module)
  }, [org])

  const value = useMemo<OrgCtx>(() => ({
    loading: profileQ.isLoading || orgsQ.isLoading || (!!org && (permsQ.isLoading || farmsQ.isLoading)),
    orgs,
    org,
    setOrgId,
    farms,
    farmId,
    farm: farms.find((f) => f.id === farmId) ?? null,
    setFarmId,
    can,
    moduleEnabled,
    profile: profileQ.data ?? null,
    refresh: () => { qc.invalidateQueries({ queryKey: ['my-orgs'] }); qc.invalidateQueries({ queryKey: ['farms-lite'] }); qc.invalidateQueries({ queryKey: ['perms'] }); qc.invalidateQueries({ queryKey: ['profile'] }) },
  }), [profileQ.isLoading, profileQ.data, orgsQ.isLoading, org, permsQ.isLoading, farmsQ.isLoading, orgs, setOrgId, farms, farmId, setFarmId, can, moduleEnabled, qc])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOrg() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useOrg fora do OrgProvider')
  return c
}

/** Atalho: retorna organização atual garantida (usar dentro de rotas protegidas). */
export function useCurrentOrg() {
  const c = useOrg()
  if (!c.org) throw new Error('Nenhuma organização selecionada')
  return { ...c, org: c.org, orgId: c.org.id }
}
