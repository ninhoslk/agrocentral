import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, HandCoins, MessagesSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Input } from '@/components/ui/primitives'
import { EmptyState, LoadingRows } from '@/components/feedback/states'
import { cn } from '@/lib/cn'
import { formatBRL, relativeTime } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'

interface Conv {
  id: string; listing_id: string; buyer_id: string; seller_id: string; buyer_name: string | null; status: string; last_message_at: string
  listings: { title: string; seller_name: string; status: string } | null
}

export function MessagesPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const convs = useQuery({
    queryKey: ['mp-convs', user?.id],
    queryFn: () => unwrap(supabase.from('conversations').select('*, listings(title, seller_name, status)').order('last_message_at', { ascending: false })) as unknown as Promise<Conv[]>,
  })
  const unread = useQuery({
    queryKey: ['mp-unread', user?.id],
    queryFn: async () => {
      const rows = await unwrap(supabase.from('messages').select('conversation_id').neq('sender_id', user!.id).is('read_at', null))
      const m = new Map<string, number>()
      rows.forEach((r) => m.set(r.conversation_id, (m.get(r.conversation_id) ?? 0) + 1))
      return m
    },
  })
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel(`mp-msgs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['mp-convs'] }); qc.invalidateQueries({ queryKey: ['mp-unread'] }); qc.invalidateQueries({ queryKey: ['mp-thread'] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => qc.invalidateQueries({ queryKey: ['mp-thread'] }))
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [user, qc])

  const active = convs.data?.find((c) => c.id === id)
  return (
    <>
      <PageHeader title="Mensagens" crumbs={[{ label: 'Negócios' }, { label: 'Marketplace', to: '/marketplace' }, { label: 'Mensagens' }]}
        description="Conversas e propostas entre compradores e anunciantes. Não compartilhe dados bancários ou senhas." />
      <div className="card grid min-h-[60vh] overflow-hidden md:grid-cols-[320px_1fr]">
        <aside className={cn('border-r border-line', id && 'hidden md:block')}>
          {convs.isLoading ? <LoadingRows /> : !convs.data?.length ? (
            <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title="Nenhuma conversa" description="Ao demonstrar interesse em um anúncio, a conversa aparece aqui." />
          ) : (
            <ul className="divide-y divide-line">
              {convs.data.map((c) => {
                const n = unread.data?.get(c.id) ?? 0
                const other = c.buyer_id === user?.id ? c.listings?.seller_name : c.buyer_name
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => navigate(`/marketplace/mensagens/${c.id}`)} className={cn('block w-full px-4 py-3 text-left hover:bg-surface', c.id === id && 'bg-brand-50')}>
                      <div className="flex items-center justify-between gap-2"><span className={cn('truncate text-sm', n && 'font-semibold')}>{c.listings?.title}</span>{n > 0 && <Badge tone="brand">{n}</Badge>}</div>
                      <div className="text-xs text-muted">{c.buyer_id === user?.id ? 'Você comprando de' : 'Interessado:'} {other} · {relativeTime(c.last_message_at)}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
        <section className={cn('flex min-h-[60vh] flex-col', !id && 'hidden md:flex')}>
          {active ? <Thread conv={active} onBack={() => navigate('/marketplace/mensagens')} /> : <EmptyState title="Selecione uma conversa" />}
        </section>
      </div>
    </>
  )
}

function Thread({ conv, onBack }: { conv: Conv; onBack: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [offer, setOffer] = useState('')
  const [offerMode, setOfferMode] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const msgs = useQuery({ queryKey: ['mp-thread', conv.id], queryFn: () => unwrap(supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at')) })
  const isBuyer = conv.buyer_id === user?.id

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.data?.length])
  useEffect(() => {
    const ids = (msgs.data ?? []).filter((m) => m.sender_id !== user?.id && !m.read_at).map((m) => m.id)
    if (ids.length) void supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then(() => { qc.invalidateQueries({ queryKey: ['mp-unread'] }); qc.invalidateQueries({ queryKey: ['mp-counters'] }) })
  }, [msgs.data, user?.id, qc])

  const send = useAppMutation(async () => {
    const offerVal = offerMode ? Number(offer.replace(/\./g, '').replace(',', '.')) : null
    if (offerMode && (!offerVal || offerVal <= 0)) throw { code: '22023', message: 'Informe um valor de proposta válido' }
    const body = text.trim() || (offerVal ? `Proposta: ${formatBRL(offerVal)}` : '')
    if (!body) throw { code: '22023', message: 'Escreva uma mensagem' }
    return unwrap(supabase.from('messages').insert({ conversation_id: conv.id, sender_id: user!.id, body, kind: offerVal ? 'proposta' : 'mensagem', offer_amount: offerVal, offer_status: offerVal ? 'pendente' : null }))
  }, { invalidate: [['mp-thread', conv.id], ['mp-convs']], onSuccess: () => { setText(''); setOffer(''); setOfferMode(false) } })
  const respond = async (mid: string, action: string) => {
    const { error } = await supabase.rpc('respond_offer', { p_message: mid, p_action: action })
    if (error) toast.error(toUserMessage(error)); else qc.invalidateQueries({ queryKey: ['mp-thread', conv.id] })
  }
  const closeConv = useAppMutation(async () => unwrap(supabase.from('conversations').update({ status: 'encerrada' }).eq('id', conv.id)), { invalidate: [['mp-convs']], success: 'Negociação encerrada' })

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Voltar" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1">
          <Link to={`/marketplace/anuncio/${conv.listing_id}`} className="block truncate text-sm font-semibold hover:underline">{conv.listings?.title}</Link>
          <div className="text-xs text-muted">{isBuyer ? `Anunciante: ${conv.listings?.seller_name}` : `Interessado: ${conv.buyer_name}`} {conv.status === 'encerrada' && <Badge>Encerrada</Badge>}</div>
        </div>
        {conv.status === 'aberta' && <Button variant="outline" size="sm" onClick={() => closeConv.mutate()}>Encerrar negociação</Button>}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto bg-surface/50 p-4" aria-live="polite">
        {msgs.isLoading && <LoadingRows rows={3} />}
        {(msgs.data ?? []).map((m) => {
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm', mine ? 'bg-brand-800 text-white' : 'bg-white')}>
                {m.kind === 'proposta' && (
                  <div className={cn('mb-1 flex items-center gap-1 text-xs font-semibold', mine ? 'text-brand-100' : 'text-brand-800')}>
                    <HandCoins className="h-3.5 w-3.5" />Proposta: {formatBRL(m.offer_amount)} · {m.offer_status}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className={cn('mt-1 text-[10px]', mine ? 'text-brand-100/80' : 'text-muted')}>{relativeTime(m.created_at)}{mine && m.read_at && ' · lida'}</div>
                {m.kind === 'proposta' && m.offer_status === 'pendente' && conv.status === 'aberta' && (
                  <div className="mt-2 flex gap-1">
                    {!mine && <><Button size="sm" variant="secondary" onClick={() => void respond(m.id, 'aceita')}>Aceitar</Button><Button size="sm" variant="outline" onClick={() => void respond(m.id, 'recusada')}>Recusar</Button></>}
                    {mine && <Button size="sm" variant="secondary" onClick={() => void respond(m.id, 'retirada')}>Retirar proposta</Button>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {conv.status === 'aberta' ? (
        <form className="flex flex-wrap gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send.mutate() }}>
          {offerMode && <Input aria-label="Valor da proposta" inputMode="decimal" placeholder="Valor R$" value={offer} onChange={(e) => setOffer(e.target.value)} className="w-32" />}
          <Input aria-label="Mensagem" maxLength={2000} placeholder="Escreva sua mensagem…" value={text} onChange={(e) => setText(e.target.value)} className="min-w-[160px] flex-1" />
          <Button type="button" variant="outline" onClick={() => setOfferMode((o) => !o)} aria-pressed={offerMode}><HandCoins className="h-4 w-4" />{offerMode ? 'Cancelar proposta' : 'Proposta'}</Button>
          <Button type="submit" loading={send.isPending}><Send className="h-4 w-4" />Enviar</Button>
        </form>
      ) : <p className="border-t border-line p-3 text-center text-sm text-muted">Negociação encerrada.</p>}
    </>
  )
}
