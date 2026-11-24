import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Flag, Heart, ImageOff, MapPin, MessageSquare, Phone, Share2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { KeyValue, PageHeader } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, FieldWrap, Select, Textarea } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/overlay'
import { DemoBadge, ErrorState, LoadingRows } from '@/components/feedback/states'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import { Logo } from '@/app/layouts/Logo'
import { CONDITIONS, LISTING_STATUS, mediaUrl, priceLabel, SAFETY_TIPS, useCategories } from './shared'
import { useFavorites } from './MarketplacePage'

const REASONS = [
  { value: 'fraude', label: 'Suspeita de fraude/golpe' }, { value: 'spam', label: 'Spam' }, { value: 'produto_proibido', label: 'Produto proibido/irregular' },
  { value: 'duplicado', label: 'Anúncio duplicado' }, { value: 'informacao_falsa', label: 'Informação falsa' }, { value: 'ofensivo', label: 'Conteúdo ofensivo' }, { value: 'outro', label: 'Outro' },
]

function useListing(id: string) {
  return useQuery({ queryKey: ['listing', id], queryFn: () => unwrap(supabase.from('listings').select('*, listing_media(id, storage_path, position)').eq('id', id).maybeSingle()) })
}

function ListingBody({ id, publicView }: { id: string; publicView?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const l = useListing(id)
  const cats = useCategories()
  const favs = useFavorites()
  const [photo, setPhoto] = useState(0)
  const [contact, setContact] = useState(false)
  const [report, setReport] = useState(false)
  const [msg, setMsg] = useState('')
  const [offer, setOffer] = useState('')
  const [reason, setReason] = useState('fraude')
  const [details, setDetails] = useState('')

  const startConversation = useAppMutation(async () => {
    const existing = await unwrap(supabase.from('conversations').select('id').eq('listing_id', id).eq('buyer_id', user!.id).maybeSingle())
    const conv = existing ?? await unwrap(supabase.from('conversations').insert({ listing_id: id, buyer_id: user!.id, seller_id: l.data!.seller_id }).select('id').single())
    const offerVal = offer.trim() ? Number(offer.replace(/\./g, '').replace(',', '.')) : null
    if (offerVal !== null && (!Number.isFinite(offerVal) || offerVal <= 0)) throw { code: '22023', message: 'Valor da proposta inválido' }
    await unwrap(supabase.from('messages').insert({ conversation_id: conv.id, sender_id: user!.id, body: msg.trim() || (offerVal ? 'Proposta enviada.' : 'Tenho interesse.'), kind: offerVal ? 'proposta' : 'mensagem', offer_amount: offerVal, offer_status: offerVal ? 'pendente' : null }))
    return conv.id
  }, { success: 'Mensagem enviada ao anunciante', onSuccess: (cid) => navigate(`/marketplace/mensagens/${cid}`) })
  const sendReport = useAppMutation(async () => unwrap(supabase.from('listing_reports').insert({ listing_id: id, reporter_id: user!.id, reason, details: details.trim() || null })),
    { success: 'Denúncia enviada para moderação. Obrigado.', onSuccess: () => setReport(false) })

  if (l.isLoading) return <LoadingRows rows={8} />
  if (l.error) return <ErrorState error={l.error} onRetry={() => l.refetch()} />
  if (!l.data) return <ErrorState error={{ code: 'PGRST116' }} />
  const d = l.data
  const media = [...(d.listing_media ?? [])].sort((a, b) => a.position - b.position)
  const mine = user?.id === d.seller_id
  const cat = cats.data?.find((c) => c.id === d.category_id)
  const parent = cats.data?.find((c) => c.id === cat?.parent_id)
  const restricted = cat?.restricted_note ?? parent?.restricted_note
  const attrs = (d.attributes ?? {}) as Record<string, string>

  const share = async () => {
    const url = `${window.location.origin}/anuncio/${id}`
    try {
      if (navigator.share) await navigator.share({ title: d.title, url })
      else { await navigator.clipboard.writeText(url); toast.success('Link copiado') }
    } catch { /* cancelado */ }
  }

  return (
    <>
      {!publicView && <PageHeader title={d.title} crumbs={[{ label: 'Negócios' }, { label: 'Marketplace', to: '/marketplace' }, { label: cat?.name ?? 'Anúncio' }]}
        badge={<>{d.status !== 'publicado' && <Badge tone={LISTING_STATUS[d.status as keyof typeof LISTING_STATUS].tone}>{LISTING_STATUS[d.status as keyof typeof LISTING_STATUS].label}</Badge>}{d.moderation_status !== 'ok' && <Badge tone="red">Em moderação</Badge>}<DemoBadge show={d.is_demo} /></>}
        actions={mine ? <Button variant="outline" onClick={() => navigate(`/marketplace/editar/${id}`)}>Editar anúncio</Button> : undefined} />}
      {publicView && <h1 className="mb-4 text-2xl font-semibold">{d.title}</h1>}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="aspect-[16/10] bg-surface">
              {media[photo] ? <img src={mediaUrl(media[photo].storage_path)} alt={`Foto ${photo + 1} de ${d.title}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-muted"><ImageOff className="h-10 w-10" /></div>}
            </div>
            {media.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-2">
                {media.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => setPhoto(i)} aria-label={`Ver foto ${i + 1}`} className={cn('h-16 w-20 shrink-0 overflow-hidden rounded-md border-2', i === photo ? 'border-brand-600' : 'border-transparent')}>
                    <img src={mediaUrl(m.storage_path)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <Card>
            <CardHeader title="Descrição" />
            <p className="whitespace-pre-wrap p-5 text-sm [overflow-wrap:anywhere] leading-relaxed">{d.description}</p>
          </Card>
          <Card>
            <CardHeader title="Características" />
            <div className="p-5">
              <KeyValue items={[
                { label: 'Categoria', value: [parent?.name, cat?.name].filter(Boolean).join(' › ') },
                { label: 'Condição', value: CONDITIONS.find((c) => c.value === d.condition)?.label },
                { label: 'Marca', value: d.brand }, { label: 'Modelo', value: d.model }, { label: 'Ano', value: d.year },
                { label: 'Horas de uso', value: d.hours_used ? `${formatNumber(d.hours_used, 0)} h` : null },
                { label: 'Quantidade', value: d.quantity ? `${formatNumber(d.quantity)} ${d.unit ?? ''}` : null },
                ...Object.entries(attrs).map(([k, v]) => ({ label: k, value: v })),
              ]} />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-2xl font-semibold text-brand-900">{priceLabel(d)}</div>
            {d.negotiable && d.price && <div className="text-sm text-muted">Aceita negociação</div>}
            <div className="mt-2 flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" />{d.city}/{d.state} (localização aproximada)</div>
            <div className="mt-1 text-xs text-muted">Publicado em {formatDate(d.published_at)}{d.expires_at && ` · expira em ${formatDate(d.expires_at)}`}</div>
            <div className="mt-4 border-t border-line pt-4 text-sm">
              <div className="text-xs text-muted">Anunciante</div>
              <div className="font-medium">{d.seller_name}</div>
              {d.show_phone && d.contact_phone && user && <a href={`tel:${d.contact_phone}`} className="mt-1 inline-flex items-center gap-1 text-brand-700 underline"><Phone className="h-4 w-4" />{d.contact_phone}</a>}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {d.is_demo && !mine ? (
                <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">Anúncio demonstrativo: mostra como o marketplace funciona. Não está à venda e não tem um anunciante real para contato.</p>
              ) : !user ? (
                <Button onClick={() => navigate('/entrar', { state: { from: `/marketplace/anuncio/${id}` } })}>Entrar para falar com o anunciante</Button>
              ) : mine ? (
                <Button variant="outline" onClick={() => navigate('/marketplace/mensagens')}>Ver mensagens do anúncio</Button>
              ) : d.status === 'publicado' ? (
                <Button onClick={() => setContact(true)}><MessageSquare className="h-4 w-4" />Tenho interesse / enviar proposta</Button>
              ) : <p className="text-sm text-muted">Este anúncio não está disponível para contato.</p>}
              <div className="flex gap-2">
                {user && !mine && <Button variant="outline" className="flex-1" onClick={() => favs.toggle(id)}><Heart className={cn('h-4 w-4', favs.set.has(id) && 'fill-danger text-danger')} />{favs.set.has(id) ? 'Salvo' : 'Salvar'}</Button>}
                <Button variant="outline" className="flex-1" onClick={() => void share()}><Share2 className="h-4 w-4" />Compartilhar</Button>
              </div>
              {user && !mine && <Button variant="ghost" size="sm" className="text-muted" onClick={() => setReport(true)}><Flag className="h-4 w-4" />Denunciar anúncio</Button>}
            </div>
          </Card>
          <Card className="bg-amber-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" />Negocie com segurança</div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">{SAFETY_TIPS.map((t) => <li key={t}>{t}</li>)}{restricted && <li><strong>{restricted}</strong></li>}</ul>
          </Card>
        </div>
      </div>

      <Dialog open={contact} onOpenChange={setContact} title="Falar com o anunciante" size="sm"
        footer={<><Button variant="outline" onClick={() => setContact(false)}>Cancelar</Button><Button loading={startConversation.isPending} onClick={() => startConversation.mutate()}>Enviar</Button></>}>
        <div className="space-y-3">
          <FieldWrap label="Mensagem" htmlFor="ct-msg"><Textarea id="ct-msg" maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Olá! Tenho interesse. O item ainda está disponível?" /></FieldWrap>
          <FieldWrap label="Proposta de valor (opcional)" htmlFor="ct-offer" hint="O anunciante poderá aceitar ou recusar. Não há pagamento pela plataforma.">
            <input id="ct-offer" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} className="h-10 w-full rounded-lg border border-line px-3 text-sm" placeholder="R$" />
          </FieldWrap>
        </div>
      </Dialog>
      <Dialog open={report} onOpenChange={setReport} title="Denunciar anúncio" size="sm"
        footer={<><Button variant="outline" onClick={() => setReport(false)}>Cancelar</Button><Button variant="danger" loading={sendReport.isPending} onClick={() => sendReport.mutate()}>Enviar denúncia</Button></>}>
        <div className="space-y-3">
          <FieldWrap label="Motivo" htmlFor="rp-reason"><Select id="rp-reason" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></FieldWrap>
          <FieldWrap label="Detalhes" htmlFor="rp-details"><Textarea id="rp-details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></FieldWrap>
          <p className="text-xs text-muted">Anúncios com várias denúncias ficam ocultos até a revisão da moderação.</p>
        </div>
      </Dialog>
    </>
  )
}

export function ListingPage() {
  const { id = '' } = useParams()
  return <ListingBody id={id} />
}

/** Página pública/compartilhável (sem necessidade de login para visualizar) */
export function PublicListingPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  return (
    <div className="min-h-dvh bg-surface">
      <header className="flex items-center justify-between bg-brand-950 px-5 py-3">
        <Link to="/"><Logo /></Link>
        {user ? <Link to="/marketplace" className="text-sm text-white underline">Ir ao marketplace</Link> : <Link to="/entrar" className="text-sm text-white underline">Entrar</Link>}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ListingBody id={id} publicView />
        {!user && <p className="mt-6 text-center text-sm text-muted">Crie sua conta gratuita para conversar com anunciantes. <Link to="/cadastro" className="text-brand-700 underline">Cadastrar</Link></p>}
      </main>
    </div>
  )
}

