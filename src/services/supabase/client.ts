import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

if (!supabaseConfigured) {
  console.error('AgroCentral: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
}

/** Cliente com chave publicável (pode ir ao navegador). Toda autorização é garantida por RLS. */
export const supabase = createClient<Database>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  global: { headers: { 'x-client-info': 'agrocentral-web' } },
})

export const functionsUrl = `${url ?? ''}/functions/v1`
