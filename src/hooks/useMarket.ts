import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import type { Quote } from '@/services/providers/market'

export interface Instrument { id: string; name: string; kind: string; unit: string; currency: string; provider: string | null; description: string | null; sort: number }

export function useMarketData(days = 120) {
  const { orgId } = useCurrentOrg()
  const instruments = useQuery({ queryKey: ['market-instruments'], staleTime: Infinity, queryFn: () => unwrap(supabase.from('market_instruments').select('*').order('sort')) as Promise<Instrument[]> })
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const quotes = useQuery({
    queryKey: ['market-quotes', orgId, days],
    queryFn: () => unwrap(supabase.from('market_quotes').select('*').or(`organization_id.is.null,organization_id.eq.${orgId}`).gte('observed_at', since).order('observed_at', { ascending: true }).limit(5000)) as unknown as Promise<Quote[]>,
  })
  return { instruments, quotes }
}

/** Agrupa por instrumento + fonte + região (nunca mistura praças/fontes diferentes). */
export function seriesOf(quotes: Quote[]) {
  const m = new Map<string, Quote[]>()
  for (const q of quotes) {
    const k = `${q.instrument_id}|${q.source}|${q.region}`
    m.set(k, [...(m.get(k) ?? []), q])
  }
  return m
}

