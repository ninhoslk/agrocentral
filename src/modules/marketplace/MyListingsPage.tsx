import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, Plus, Tag } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button } from '@/components/ui/primitives'
import { useConfirm } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { EmptyState, LoadingRows } from '@/components/feedback/states'
import { formatDate } from '@/lib/format'
import { LISTING_STATUS, ListingCardView, priceLabel, type ListingCard } from './shared'
import { useFavorites } from './MarketplacePage'

type Mine = ListingCard & { moderation_status: string; moderation_note: string | null; expires_at: string | null; conversations: { count: number }[] }

export function MyListingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { confirm, node } = useConfirm()
  const q = useQuery({
    queryKey: ['mp-mine', user?.id],
    queryFn: () => unwrap(supabase.from('listings').select('id, title, price, currency, price_unit, negotiable, city, state, condition, category_id, status, published_at, is_demo, year, brand, model, moderation_status, moderation_note, expires_at, listing_media(storage_path, position), conversations(count)').eq('seller_id', user!.id).order('updated_at', { ascending: false })) as unknown as Promise<Mine[]>,
  })
  const setStatus = useAppMutation(async ({ id, status }: { id: string; status: string }) => unwrap(supabase.from('listings').update({ status }).eq('id', id)),
    { invalidate: [['mp-mine'], ['mp-search'], ['listing']], success: 'Status atualizado' })
  const del = useAppMutation(async (id: string) => unwrap(supabase.from('listings').delete().eq('id', id)), { invalidate: [['mp-mine']], success: 'Rascunho excluído' })

  const cols: Column<Mine>[] = [
    { key: 'title', header: 'Anúncio', primary: true, sortable: true, value: (r) => r.title, cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'price', header: 'Preço', value: (r) => r.price, cell: (r) => priceLabel(r) },
    { key: 'status', header: 'Status', value: (r) => r.status, cell: (r) => <span className="flex flex-wrap gap-1"><Badge tone={LISTING_STATUS[r.status as keyof typeof LISTING_STATUS].tone}>{LISTING_STATUS[r.status as keyof typeof LISTING_STATUS].label}</Badge>{r.moderation_status !== 'ok' && <Badge tone="red" title={r.moderation_note ?? ''}>Moderação: {r.moderation_status}</Badge>}</span> },
    { key: 'conv', header: 'Conversas', align: 'right', value: (r) => r.conversations?.[0]?.count ?? 0, cell: (r) => r.conversations?.[0]?.count ?? 0 },
    { key: 'exp', header: 'Expira em', value: (r) => r.expires_at, cell: (r) => formatDate(r.expires_at) },
    { key: 'act', header: '', align: 'right', cell: (r) => (
      <span className="inline-flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {r.status !== 'removido' && <Button variant="ghost" size="sm" onClick={() => navigate(`/marketplace/editar/${r.id}`)}>Editar</Button>}
        {r.status === 'publicado' && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: r.id, status: 'pausado' })}>Pausar</Button>}
        {['pausado', 'rascunho', 'expirado'].includes(r.status) && r.moderation_status === 'ok' && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: r.id, status: 'publicado' })}>{r.status === 'expirado' ? 'Renovar' : 'Publicar'}</Button>}
        {['publicado', 'pausado'].includes(r.status) && <Button variant="ghost" size="sm" onClick={async () => { if (await confirm('Marcar como vendido?', 'O anúncio fica visível como vendido e deixa de receber contatos.', 'Marcar vendido')) setStatus.mutate({ id: r.id, status: 'vendido' }) }}>Vendido</Button>}
        {r.status === 'rascunho' && <Button variant="ghost" size="sm" className="text-danger" onClick={async () => { if (await confirm('Excluir rascunho?', undefined, 'Excluir')) del.mutate(r.id) }}>Excluir</Button>}
      </span>) },
  ]
  return (
    <>
      <PageHeader title="Meus anúncios" crumbs={[{ label: 'Negócios' }, { label: 'Marketplace', to: '/marketplace' }, { label: 'Meus anúncios' }]}
        actions={<Button onClick={() => navigate('/marketplace/novo')}><Plus className="h-4 w-4" />Novo anúncio</Button>} />
      <DataTable rows={q.data} columns={cols} loading={q.isLoading} error={q.error} onRowClick={(r) => navigate(`/marketplace/anuncio/${r.id}`)} exportName="Meus anúncios"
        empty={<EmptyState icon={<Tag className="h-6 w-6" />} title="Você ainda não anunciou" description="Publique máquinas, insumos, grãos ou serviços." action={<Button onClick={() => navigate('/marketplace/novo')}>Criar anúncio</Button>} />} />
      {node}
    </>
  )
}

export function FavoritesPage() {
  const favs = useFavorites()
  const q = useQuery({
    queryKey: ['mp-fav-list'],
    queryFn: () => unwrap(supabase.from('listing_favorites').select('created_at, listings(id, title, price, currency, price_unit, negotiable, city, state, condition, category_id, status, published_at, is_demo, year, brand, model, listing_media(storage_path, position))').order('created_at', { ascending: false })),
  })
  const rows = (q.data ?? []).map((f) => f.listings as unknown as ListingCard | null).filter(Boolean) as ListingCard[]
  return (
    <>
      <PageHeader title="Favoritos" crumbs={[{ label: 'Negócios' }, { label: 'Marketplace', to: '/marketplace' }, { label: 'Favoritos' }]} description="Anúncios salvos. Anúncios removidos pela moderação ou excluídos deixam de aparecer." />
      {q.isLoading ? <LoadingRows /> : !rows.length ? <div className="card"><EmptyState icon={<Heart className="h-6 w-6" />} title="Nenhum favorito" description="Toque em Salvar nos anúncios que quiser acompanhar." /></div> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((l) => <ListingCardView key={l.id} l={l} fav={favs.set.has(l.id)} onFav={() => favs.toggle(l.id)} />)}
        </div>
      )}
    </>
  )
}
