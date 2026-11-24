import { supabase } from '@/services/supabase/client'
import type { DataState } from '@/components/feedback/states'

export interface Quote {
  id: string; instrument_id: string; organization_id: string | null; value: number; currency: string; unit: string; region: string
  source: string; source_url: string | null; observed_at: string; fetched_at: string; status: 'oficial' | 'indicativo' | 'atrasado' | 'demonstrativo' | 'manual'
  is_demo: boolean; notes: string | null
}

/** Solicita sincronização das séries oficiais (o backend limita a frequência). */
export async function syncOfficialQuotes() {
  const { data, error } = await supabase.functions.invoke<{ skipped: boolean; inserted: number; errors: string[] }>('market-sync', { body: {} })
  if (error) throw error
  return data!
}

/** Dias úteis entre a data de referência e hoje (aprox., sem feriados) */
export function businessDaysSince(iso: string, now = new Date()) {
  const d = new Date(iso)
  let n = 0
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  while (c < end) { c.setDate(c.getDate() + 1); if (c.getDay() !== 0 && c.getDay() !== 6) n++ }
  return n
}

/** Estado de exibição do dado: oficial recente = real; oficial com atraso = desatualizado; etc. */
export function quoteState(q: Pick<Quote, 'status' | 'observed_at'>, now = new Date()): DataState {
  if (q.status === 'demonstrativo') return 'demo'
  if (q.status === 'manual') return 'manual'
  if (q.status === 'atrasado' || businessDaysSince(q.observed_at, now) > 2) return 'stale'
  return 'real'
}

/** Variação percentual entre a última cotação e a anterior da mesma série (mesma região/fonte). */
export function variation(series: Pick<Quote, 'value' | 'observed_at'>[], daysBack = 1) {
  const s = [...series].sort((a, b) => a.observed_at.localeCompare(b.observed_at))
  if (s.length < 2) return null
  const last = s[s.length - 1]
  let ref: (typeof s)[number] | undefined
  if (daysBack <= 1) ref = s[s.length - 2]
  else {
    const target = new Date(last.observed_at); target.setDate(target.getDate() - daysBack)
    ref = [...s].reverse().find((x) => new Date(x.observed_at) <= target)
  }
  if (!ref || Number(ref.value) === 0) return null
  return ((Number(last.value) - Number(ref.value)) / Number(ref.value)) * 100
}
