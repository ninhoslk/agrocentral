import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'

interface AuthCtx {
  session: Session | null
  user: User | null
  loading: boolean
  /** true quando o usuário chegou por um link de recuperação de senha */
  recovering: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') {
        qc.clear()
        try { localStorage.removeItem('agro.org') } catch { /* armazenamento indisponível */ }
      }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [qc])

  const value = useMemo<AuthCtx>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    recovering,
    signOut: async () => { await supabase.auth.signOut() },
  }), [session, loading, recovering])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
