import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toUserMessage } from '@/lib/errors'

/** Resolve uma chamada do Supabase lançando o erro (para o TanStack Query tratar). */
type DataOf<P> = P extends PromiseLike<infer R> ? (R extends { data: infer D } ? D : never) : never

export async function unwrap<P extends PromiseLike<{ data: unknown; error: unknown }>>(p: P): Promise<NonNullable<DataOf<P>>> {
  const { data, error } = await p
  if (error) throw error
  return data as NonNullable<DataOf<P>>
}

/** Mutação com toast de erro padronizado e invalidação de chaves. */
export function useAppMutation<TVars, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { invalidate?: QueryKey[]; success?: string | ((r: TRes) => string); onSuccess?: (r: TRes, v: TVars) => void; silentError?: boolean } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success)
      opts.onSuccess?.(r, v)
    },
    onError: (e) => {
      if (!opts.silentError) {
        toast.error(toUserMessage(e))
        try { (e as { __toasted?: boolean }).__toasted = true } catch { /* objeto congelado */ }
      }
    },
  })
}
