import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, ImageOff, MapPin } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { Badge } from '@/components/ui/primitives'
import { DemoBadge } from '@/components/feedback/states'
import { cn } from '@/lib/cn'
import { formatBRL, formatNumber, relativeTime } from '@/lib/format'

export const CONDITIONS = [
  { value: 'novo', label: 'Novo' }, { value: 'seminovo', label: 'Seminovo' }, { value: 'usado', label: 'Usado' },
  { value: 'recondicionado', label: 'Recondicionado' }, { value: 'nao_aplica', label: 'Não se aplica' },
]
export const LISTING_STATUS = {
  rascunho: { label: 'Rascunho', tone: 'neutral' }, publicado: { label: 'Publicado', tone: 'green' }, pausado: { label: 'Pausado', tone: 'yellow' },
  vendido: { label: 'Vendido', tone: 'blue' }, expirado: { label: 'Expirado', tone: 'neutral' }, removido: { label: 'Removido', tone: 'red' },
} as const

export interface ListingCard {
  id: string; title: string; price: number | null; currency: string; price_unit: string | null; negotiable: boolean; city: string; state: string
  condition: string; category_id: string; status: string; published_at: string | null; is_demo: boolean; year: number | null; brand: string | null; model: string | null
  listing_media: { storage_path: string; position: number }[]
}

export const mediaUrl = (path: string) => supabase.storage.from('listing-media').getPublicUrl(path).data.publicUrl

export function useCategories() {
  return useQuery({ queryKey: ['mp-categories'], staleTime: Infinity, queryFn: () => unwrap(supabase.from('marketplace_categories').select('*').order('sort')) })
}

export function priceLabel(l: Pick<ListingCard, 'price' | 'currency' | 'price_unit' | 'negotiable'>) {
  if (!l.price) return 'A combinar'
  const v = l.currency === 'USD' ? `US$ ${formatNumber(l.price, 2)}` : formatBRL(l.price)
  return `${v}${l.price_unit ? ` / ${l.price_unit}` : ''}`
}

export function ListingCardView({ l, fav, onFav, to }: { l: ListingCard; fav?: boolean; onFav?: () => void; to?: string }) {
  const cover = [...(l.listing_media ?? [])].sort((a, b) => a.position - b.position)[0]
  return (
    <article className="card group overflow-hidden">
      <Link to={to ?? `/marketplace/anuncio/${l.id}`} className="flex sm:block">
        <div className="relative aspect-square w-28 shrink-0 bg-surface sm:aspect-[4/3] sm:w-auto">
          {cover ? <img src={mediaUrl(cover.storage_path)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted"><ImageOff className="h-6 w-6 sm:h-8 sm:w-8" /></div>}
          {l.status !== 'publicado' && <Badge tone={LISTING_STATUS[l.status as keyof typeof LISTING_STATUS]?.tone} className="absolute left-1.5 top-1.5">{LISTING_STATUS[l.status as keyof typeof LISTING_STATUS]?.label}</Badge>}
        </div>
        <div className="min-w-0 flex-1 space-y-1 p-3">
          <h3 className="line-clamp-2 text-sm font-medium group-hover:underline">{l.title}</h3>
          <div className="text-base font-semibold text-brand-900">{priceLabel(l)}{l.negotiable && l.price ? <span className="ml-1 text-xs font-normal text-muted">negociável</span> : null}</div>
          <div className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" />{l.city}/{l.state}{l.published_at && ` · ${relativeTime(l.published_at)}`}</div>
          <DemoBadge show={l.is_demo} />
        </div>
      </Link>
      {onFav && (
        <div className="flex justify-end border-t border-line px-2 py-1">
          <button type="button" onClick={onFav} aria-pressed={fav} aria-label={fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'} className="inline-flex items-center gap-1 rounded p-1.5 text-xs text-muted hover:bg-black/5">
            <Heart className={cn('h-4 w-4', fav && 'fill-danger text-danger')} />{fav ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      )}
    </article>
  )
}

export const SAFETY_TIPS = [
  'A AgroCentral aproxima as partes; não intermedia pagamentos nem garante entrega, procedência ou qualidade.',
  'Verifique pessoalmente máquinas, documentação, notas fiscais e titularidade antes de negociar.',
  'Desconfie de preços muito abaixo do mercado e de pedidos de pagamento antecipado.',
  'Insumos como defensivos e sementes exigem registro e, quando aplicável, receituário agronômico.',
]
