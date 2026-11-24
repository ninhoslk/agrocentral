import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import type { Tables } from '@/types/database'

export type FarmRow = Tables<'farms'>
export type FieldRow = Tables<'fields'>
export type PoiRow = Tables<'points_of_interest'>

export function useFarm(id: string | null | undefined) {
  return useQuery({
    queryKey: ['farm', id],
    enabled: !!id,
    queryFn: () => unwrap(supabase.from('farms').select('*').eq('id', id!).single()),
  })
}

export function useFarmFields(farmId: string | null | undefined, includeArchived = false) {
  return useQuery({
    queryKey: ['fields', 'farm', farmId, includeArchived],
    enabled: !!farmId,
    queryFn: () => {
      let q = supabase.from('fields').select('*').eq('farm_id', farmId!).order('name')
      if (!includeArchived) q = q.is('archived_at', null)
      return unwrap(q)
    },
  })
}

export function useFarmPois(farmId: string | null | undefined) {
  return useQuery({
    queryKey: ['pois', farmId],
    enabled: !!farmId,
    queryFn: () => unwrap(supabase.from('points_of_interest').select('*').eq('farm_id', farmId!).order('name')),
  })
}

/** Cultura atual de cada talhão (safras planejadas/em andamento) */
export function useCurrentCrops(farmId: string | null | undefined) {
  return useQuery({
    queryKey: ['current-crops', farmId],
    enabled: !!farmId,
    queryFn: async () => {
      const rows = await unwrap(
        supabase.from('season_fields')
          .select('field_id, stage, seasons!inner(id, name, status, crops(name, color))')
          .eq('farm_id', farmId!)
          .in('seasons.status', ['planejada', 'em_andamento']),
      )
      const map = new Map<string, { season: string; seasonId: string; crop: string; color: string | null; stage: string | null }>()
      for (const r of rows) {
        const s = r.seasons as unknown as { id: string; name: string; crops: { name: string; color: string | null } | null }
        map.set(r.field_id, { season: s.name, seasonId: s.id, crop: s.crops?.name ?? '', color: s.crops?.color ?? null, stage: r.stage })
      }
      return map
    },
  })
}
