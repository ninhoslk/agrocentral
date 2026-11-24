import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useOrg } from '@/app/providers/OrgProvider'
import type { Option } from '@/components/forms/ResourceForm'

/** Listas auxiliares para selects, sempre limitadas à organização atual (e RLS). */
export function useLookups() {
  const { org, can } = useOrg()
  const orgId = org?.id
  const opts = { enabled: !!orgId, staleTime: 60_000 }

  const fields = useQuery({
    queryKey: ['lk-fields', orgId], ...opts, enabled: opts.enabled && can('fields'),
    queryFn: () => unwrap(supabase.from('fields').select('id, name, code, farm_id, area_ha, manual_area_ha, is_demo').eq('organization_id', orgId!).is('archived_at', null).order('name')),
  })
  const seasons = useQuery({
    queryKey: ['lk-seasons', orgId], ...opts, enabled: opts.enabled && can('seasons'),
    queryFn: () => unwrap(supabase.from('seasons').select('id, name, farm_id, status, crop_id').eq('organization_id', orgId!).is('archived_at', null).order('start_date', { ascending: false })),
  })
  const seasonFields = useQuery({
    queryKey: ['lk-season-fields', orgId], ...opts, enabled: opts.enabled && can('seasons'),
    queryFn: () => unwrap(supabase.from('season_fields').select('season_id, field_id').eq('organization_id', orgId!)),
  })
  const employees = useQuery({
    queryKey: ['lk-employees', orgId], ...opts, enabled: opts.enabled && can('team'),
    queryFn: () => unwrap(supabase.from('employees').select('id, full_name, farm_id, user_id, status').eq('organization_id', orgId!).is('archived_at', null).order('full_name')),
  })
  const teams = useQuery({
    queryKey: ['lk-teams', orgId], ...opts, enabled: opts.enabled && can('team'),
    queryFn: () => unwrap(supabase.from('teams').select('id, name, farm_id').eq('organization_id', orgId!).order('name')),
  })
  const equipment = useQuery({
    queryKey: ['lk-equipment', orgId], ...opts, enabled: opts.enabled && can('equipment'),
    queryFn: () => unwrap(supabase.from('equipment').select('id, name, kind, farm_id, hour_meter').eq('organization_id', orgId!).is('archived_at', null).order('name')),
  })
  const items = useQuery({
    queryKey: ['lk-items', orgId], ...opts, enabled: opts.enabled && can('inventory'),
    queryFn: () => unwrap(supabase.from('inventory_items').select('id, name, unit, category, current_quantity, average_cost, farm_id').eq('organization_id', orgId!).is('archived_at', null).order('name')),
  })
  const crops = useQuery({
    queryKey: ['lk-crops', orgId], ...opts,
    queryFn: () => unwrap(supabase.from('crops').select('id, name, slug, yield_unit, sack_weight_kg, color, organization_id').order('name')),
  })
  const varieties = useQuery({
    queryKey: ['lk-varieties', orgId], ...opts, enabled: opts.enabled && can('seasons'),
    queryFn: () => unwrap(supabase.from('varieties').select('id, name, crop_id').eq('organization_id', orgId!).order('name')),
  })
  const activityTypes = useQuery({
    queryKey: ['lk-activity-types', orgId], ...opts,
    queryFn: () => unwrap(supabase.from('activity_types').select('id, name, slug, color').order('name')),
  })
  const categories = useQuery({
    queryKey: ['lk-fin-categories', orgId], ...opts, enabled: opts.enabled && can('finance'),
    queryFn: () => unwrap(supabase.from('financial_categories').select('id, name, kind, slug').order('name')),
  })
  const contacts = useQuery({
    queryKey: ['lk-contacts', orgId], ...opts, enabled: opts.enabled && (can('finance') || can('inventory')),
    queryFn: () => unwrap(supabase.from('contacts').select('id, name, kind').eq('organization_id', orgId!).is('archived_at', null).order('name')),
  })
  const accounts = useQuery({
    queryKey: ['lk-accounts', orgId], ...opts, enabled: opts.enabled && can('finance'),
    queryFn: () => unwrap(supabase.from('financial_accounts').select('id, name').eq('organization_id', orgId!).is('archived_at', null).order('name')),
  })
  const costCenters = useQuery({
    queryKey: ['lk-cost-centers', orgId], ...opts, enabled: opts.enabled && can('finance'),
    queryFn: () => unwrap(supabase.from('cost_centers').select('id, name').eq('organization_id', orgId!).order('name')),
  })
  const locations = useQuery({
    queryKey: ['lk-locations', orgId], ...opts, enabled: opts.enabled && can('inventory'),
    queryFn: () => unwrap(supabase.from('inventory_locations').select('id, name, farm_id').eq('organization_id', orgId!).order('name')),
  })
  return { fields, seasons, seasonFields, employees, teams, equipment, items, crops, varieties, activityTypes, categories, contacts, accounts, costCenters, locations }
}

export const toOptions = <T extends { id: string }>(rows: T[] | undefined, label: (r: T) => string): Option[] =>
  (rows ?? []).map((r) => ({ value: r.id, label: label(r) }))

/** Mapa id -> rótulo para exibir nomes em tabelas */
export const byId = <T extends { id: string }>(rows: T[] | undefined) => new Map((rows ?? []).map((r) => [r.id, r]))
