import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { useLookups } from '@/hooks/useLookups'
import type { ActualTx, BudgetLine, Scenario } from '@/lib/budget'

export interface BudgetFilters {
  season: string
  crop: string
  field: string
  category: string
  from: string
  to: string
}
export const EMPTY_FILTERS: BudgetFilters = { season: '', crop: '', field: '', category: '', from: '', to: '' }

export type LineRow = BudgetLine & {
  organization_id: string
  subcategory: string | null
  contact_id: string | null
  inventory_item_id: string | null
  equipment_id: string | null
  activity_id: string | null
  payment_method: string | null
  payment_terms: string | null
  recurrence: string
  notes: string | null
  is_demo: boolean
  tx_count: number
}
export type ScenarioRow = Scenario & { id: string; farm_id: string | null; season_id: string | null; notes: string | null; kind: string }
type TxRow = ActualTx & { id: string; description: string; farm_id: string | null }

export const BUDGET_KEYS = [['budget-lines'], ['budget-actuals'], ['budget-scenarios'], ['transactions'], ['dashboard'], ['fin-account-balances'], ['lk-budget-lines']]

/** Carrega orçado, realizado, cenários e áreas no escopo da propriedade selecionada. */
export function useBudgetData(f: BudgetFilters) {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const lk = useLookups()

  const linesQ = useQuery({
    queryKey: ['budget-lines', orgId, farmId],
    queryFn: () => {
      let qb = supabase.from('budget_lines_v').select('*').eq('organization_id', orgId).is('archived_at', null).order('planned_date').limit(5000)
      if (farmId) qb = qb.eq('farm_id', farmId)
      return unwrap(qb) as unknown as Promise<LineRow[]>
    },
  })
  const actualsQ = useQuery({
    queryKey: ['budget-actuals', orgId, farmId],
    enabled: can('finance'),
    queryFn: () => {
      let qb = supabase.from('transactions_v').select('id, kind, amount, status, due_date, paid_date, category_id, category_name, farm_id, season_id, field_id, crop_id, activity_id, budget_line_id, description')
        .eq('organization_id', orgId).is('archived_at', null).neq('status', 'cancelado').limit(10000)
      if (farmId) qb = qb.eq('farm_id', farmId)
      return unwrap(qb) as unknown as Promise<TxRow[]>
    },
  })
  const scenariosQ = useQuery({
    queryKey: ['budget-scenarios', orgId, farmId],
    queryFn: () => {
      let qb = supabase.from('budget_scenarios').select('*').eq('organization_id', orgId).order('created_at')
      if (farmId) qb = qb.or(`farm_id.eq.${farmId},farm_id.is.null`)
      return unwrap(qb) as unknown as Promise<ScenarioRow[]>
    },
  })
  const plantedQ = useQuery({
    queryKey: ['budget-planted', orgId],
    enabled: can('seasons'),
    queryFn: () => unwrap(supabase.from('season_fields').select('season_id, field_id, planted_area_ha').eq('organization_id', orgId)),
  })
  const activitiesQ = useQuery({
    queryKey: ['budget-activities', orgId, farmId],
    enabled: can('activities'),
    staleTime: 60_000,
    queryFn: () => {
      let qb = supabase.from('activities').select('id, title, started_at, farm_id, season_id, field_id, activity_types(name)').eq('organization_id', orgId).is('archived_at', null).order('started_at', { ascending: false }).limit(300)
      if (farmId) qb = qb.eq('farm_id', farmId)
      return unwrap(qb)
    },
  })
  const cashQ = useQuery({
    queryKey: ['budget-cash', orgId],
    enabled: can('finance'),
    queryFn: async () => {
      const [acc, paid] = await Promise.all([
        unwrap(supabase.from('financial_accounts').select('id, initial_balance').eq('organization_id', orgId).is('archived_at', null)),
        unwrap(supabase.from('transactions').select('account_id, kind, amount').eq('organization_id', orgId).eq('status', 'pago').not('account_id', 'is', null)),
      ])
      if (!acc.length) return null
      const ids = new Set(acc.map((a) => a.id))
      return acc.reduce((s, a) => s + Number(a.initial_balance), 0) +
        paid.filter((t) => t.account_id && ids.has(t.account_id)).reduce((s, t) => s + (t.kind === 'receita' ? 1 : -1) * Number(t.amount), 0)
    },
  })

  const inPeriod = (d: string | null | undefined) => !!d && (!f.from || d >= f.from) && (!f.to || d <= f.to)
  const match = (x: { season_id?: string | null; crop_id?: string | null; field_id?: string | null; category_id?: string }) =>
    (!f.season || x.season_id === f.season) && (!f.crop || x.crop_id === f.crop) && (!f.field || x.field_id === f.field) && (!f.category || x.category_id === f.category)

  const lines = useMemo(() => (linesQ.data ?? []).filter((l) => match(l) && (!f.from && !f.to ? true : inPeriod(l.planned_date))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesQ.data, f])
  const actuals = useMemo(() => (actualsQ.data ?? []).filter((t) => match(t) && (!f.from && !f.to ? true : inPeriod(t.status === 'pago' && t.paid_date ? t.paid_date : t.due_date))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actualsQ.data, f])

  // Área de referência: talhão → área do talhão; safra → área plantada; senão propriedades
  const fieldArea = (id: string) => { const x = lk.fields.data?.find((y) => y.id === id); return Number(x?.manual_area_ha ?? x?.area_ha ?? 0) }
  const seasonArea = (id: string) => (plantedQ.data ?? []).filter((p) => p.season_id === id).reduce((a, p) => a + Number(p.planted_area_ha ?? fieldArea(p.field_id)), 0)
  const cropArea = (cropId: string) => (lk.seasons.data ?? []).filter((s) => s.crop_id === cropId && (!farmId || s.farm_id === farmId)).reduce((a, s) => a + seasonArea(s.id), 0)
  const farmArea = (id: string) => { const x = farms.find((y) => y.id === id); return Number(x?.productive_area_ha ?? x?.total_area_ha ?? 0) }
  const area = f.field ? fieldArea(f.field) : f.season ? seasonArea(f.season) : f.crop ? cropArea(f.crop)
    : farms.filter((x) => !farmId || x.id === farmId).reduce((a, x) => a + farmArea(x.id), 0)

  return {
    lines, actuals, allLines: linesQ.data ?? [], scenarios: scenariosQ.data ?? [], activities: activitiesQ.data ?? [], cash: cashQ.data ?? null,
    area, fieldArea, seasonArea, cropArea, farmArea,
    loading: linesQ.isLoading || actualsQ.isLoading, error: linesQ.error ?? actualsQ.error,
    refetch: () => { void linesQ.refetch(); void actualsQ.refetch() },
    financeAccess: can('finance'),
  }
}
