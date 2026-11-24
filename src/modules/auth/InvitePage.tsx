import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useState } from 'react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { toUserMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOrg, ROLE_LABELS, type Role } from '@/app/providers/OrgProvider'
import { Button, Spinner } from '@/components/ui/primitives'
import { AuthShell } from './AuthPages'

export function InvitePage() {
  const { token = '' } = useParams()
  const { session, user, signOut } = useAuth()
  const { refresh, setOrgId } = useOrg()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const valid = /^[0-9a-f-]{36}$/i.test(token)

  const inv = useQuery({
    queryKey: ['invitation', token],
    enabled: !!session && valid,
    queryFn: async () => (await unwrap(supabase.rpc('get_invitation', { p_token: token })))[0] ?? null,
  })

  if (!session) {
    return (
      <AuthShell title="Convite para a AgroCentral" subtitle="Entre ou crie sua conta com o e-mail que recebeu o convite.">
        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate('/entrar', { state: { from: `/convite/${token}` } })}>Já tenho conta — entrar</Button>
          <Button variant="outline" onClick={() => navigate(`/cadastro?convite=${token}`)}>Criar conta</Button>
        </div>
      </AuthShell>
    )
  }

  const accept = async () => {
    setBusy(true)
    try {
      const orgId = await unwrap(supabase.rpc('accept_invitation', { p_token: token }))
      setOrgId(orgId as string)
      refresh()
      toast.success('Convite aceito')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally { setBusy(false) }
  }

  const i = inv.data
  return (
    <AuthShell title="Convite" footer={<Link to="/" className="underline">Ir para o início</Link>}>
      {!valid ? <p className="text-sm text-danger">Link de convite inválido.</p>
        : inv.isLoading ? <Spinner />
        : !i ? <p className="text-sm text-muted">Convite não encontrado.</p>
        : i.status !== 'pending' ? <p className="text-sm text-muted">Este convite está {i.status === 'accepted' ? 'já aceito' : i.status === 'expired' ? 'expirado' : 'revogado'}. Peça um novo convite ao administrador.</p>
        : (
          <div className="space-y-4 text-sm">
            <p>Você foi convidado(a) para participar de <strong>{i.organization_name}</strong> como <strong>{ROLE_LABELS[i.role as Role]}</strong>.</p>
            <p className="text-xs text-muted">Convite para {i.email} · válido até {formatDate(i.expires_at)}</p>
            {user?.email?.toLowerCase() !== i.email.toLowerCase() ? (
              <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
                Você está conectado como <strong>{user?.email}</strong>. Entre com <strong>{i.email}</strong> para aceitar.
                <Button variant="outline" size="sm" className="mt-2" onClick={() => void signOut()}>Sair e trocar de conta</Button>
              </div>
            ) : (
              <Button onClick={() => void accept()} loading={busy} className="w-full">Aceitar convite</Button>
            )}
          </div>
        )}
    </AuthShell>
  )
}
