import { supabase } from '@/services/supabase/client'

export interface GeocodeResult { lat: number; lon: number; label: string; source: string; cached: boolean }

/**
 * Geocodificação pontual via backend (Edge Function "geocode" -> Nominatim/OSM),
 * com cache e limite de 1 req/s no servidor. Nunca usada como autocomplete.
 */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  const { data, error } = await supabase.functions.invoke<{ results: GeocodeResult[] }>('geocode', { body: { q: query } })
  if (error) throw error
  return data?.results ?? []
}
