import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal, Store } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { PageHeader } from '@/components/ui/layout'
import { Button, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/states'
import { UFS } from '@/services/providers/ibge'
import { cn } from '@/lib/cn'
import { CONDITIONS, ListingCardView, useCategories, type ListingCard } from './shared'

const PAGE = 24

export function useFavorites() {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['mp-favs', user?.id], enabled: !!user, queryFn: () => unwrap(supabase.from('listing_favorites').select('listing_id')) })
  const set = useMemo(() => new Set((q.data ?? []).map((f) => f.listing_id)), [q.data])
  const toggle = useAppMutation(async (id: string) => set.has(id)
    ? unwrap(supabase.from('listing_favorites').delete().eq('listing_id', id).eq('user_id', user!.id))
    : unwrap(supabase.from('listing_favorites').insert({ listing_id: id, user_id: user!.id })), { invalidate: [['mp-favs'], ['mp-counters'], ['mp-fav-list']] })
  return { set, toggle: (id: string) => toggle.mutate(id) }
}

export function MarketplacePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const cats = useCategories()
  const favs = useFavorites()
  const [showFilters, setShowFilters] = useState(false)
  const [text, setText] = useState(params.get('q') ?? '')
  const f = {
    q: params.get('q') ?? '', cat: params.get('categoria') ?? '', uf: params.get('uf') ?? '', city: params.get('cidade') ?? '',
    min: params.get('min') ?? '', max: params.get('max') ?? '', cond: params.get('condicao') ?? '', brand: params.get('marca') ?? '',
    sort: params.get('ordem') ?? 'recentes', page: Number(params.get('p') ?? 0),
  }
  const setF = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    if (!('p' in patch)) next.delete('p')
    setParams(next)
  }
  const catIds = useMemo(() => {
    if (!f.cat) return null
    return [f.cat, ...(cats.data ?? []).filter((c) => c.parent_id === f.cat).map((c) => c.id)]
  }, [f.cat, cats.data])

  const q = useQuery({
    queryKey: ['mp-search', f, catIds],
    queryFn: async () => {
      let qb = supabase.from('listings').select('id, title, price, currency, price_unit, negotiable, city, state, condition, category_id, status, published_at, is_demo, year, brand, model, listing_media(storage_path, position)', { count: 'exact' })
        .eq('status', 'publicado').eq('moderation_status', 'ok')
      if (f.q) qb = qb.textSearch('search_vector', f.q, { type: 'websearch', config: 'portuguese' })
      if (catIds) qb = qb.in('category_id', catIds)
      if (f.uf) qb = qb.eq('state', f.uf)
      if (f.city) qb = qb.ilike('city', `%${f.city.replace(/[%_]/g, '')}%`)
      if (f.min) qb = qb.gte('price', Number(f.min))
      if (f.max) qb = qb.lte('price', Number(f.max))
      if (f.cond) qb = qb.eq('condition', f.cond)
      if (f.brand) qb = qb.ilike('brand', `%${f.brand.replace(/[%_]/g, '')}%`)
      qb = f.sort === 'menor_preco' ? qb.order('price', { ascending: true, nullsFirst: false }) : f.sort === 'maior_preco' ? qb.order('price', { ascending: false, nullsFirst: false }) : qb.order('published_at', { ascending: false })
      const { data, error, count } = await qb.range(f.page * PAGE, f.page * PAGE + PAGE - 1)
      if (error) throw error
      return { rows: data as unknown as ListingCard[], count: count ?? 0 }
    },
  })
  const roots = (cats.data ?? []).filter((c) => !c.parent_id)
  const pages = Math.ceil((q.data?.count ?? 0) / PAGE)

  return (
    <>
      <PageHeader title="Marketplace" crumbs={[{ label: 'Negócios' }, { label: 'Marketplace' }]}
        description="Máquinas, implementos, insumos, grãos, serviços, frete e imóveis rurais. A AgroCentral aproxima as partes — a negociação é entre comprador e anunciante."
        actions={<Button onClick={() => navigate('/marketplace/novo')}><Plus className="h-4 w-4" />Anunciar</Button>} />
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setF({ q: text.trim() }) }} role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar: trator 4x4, plantadeira, soja, frete…" className="h-11 pl-9" aria-label="Buscar anúncios" />
        </div>
        <Button type="submit" size="lg">Buscar</Button>
        <Button type="button" variant="outline" size="lg" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}><SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filtros</span></Button>
      </form>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button type="button" onClick={() => setF({ categoria: '' })} className={cn('min-h-10 whitespace-nowrap rounded-full border px-3.5 text-sm sm:min-h-8', !f.cat ? 'border-brand-700 bg-brand-800 text-white' : 'border-line bg-white hover:bg-surface')}>Todas</button>
        {roots.map((c) => (
          <button key={c.id} type="button" onClick={() => setF({ categoria: c.id })} className={cn('min-h-10 whitespace-nowrap rounded-full border px-3.5 text-sm sm:min-h-8', f.cat === c.id ? 'border-brand-700 bg-brand-800 text-white' : 'border-line bg-white hover:bg-surface')}>{c.name}</button>
        ))}
      </div>
      {showFilters && (
        <div className="card mb-4 grid grid-cols-2 gap-3 p-3 md:grid-cols-4 lg:grid-cols-7">
          <FieldWrap label="Subcategoria" htmlFor="mf-sub"><Select id="mf-sub" value={f.cat} onChange={(e) => setF({ categoria: e.target.value })}><option value="">Todas</option>{(cats.data ?? []).filter((c) => c.parent_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FieldWrap>
          <FieldWrap label="UF" htmlFor="mf-uf"><Select id="mf-uf" value={f.uf} onChange={(e) => setF({ uf: e.target.value })}><option value="">Todas</option>{UFS.map((u) => <option key={u}>{u}</option>)}</Select></FieldWrap>
          <FieldWrap label="Município" htmlFor="mf-city"><Input id="mf-city" defaultValue={f.city} onBlur={(e) => setF({ cidade: e.target.value.trim() })} /></FieldWrap>
          <FieldWrap label="Preço mín." htmlFor="mf-min"><Input id="mf-min" inputMode="decimal" defaultValue={f.min} onBlur={(e) => setF({ min: e.target.value.replace(/\D/g, '') })} /></FieldWrap>
          <FieldWrap label="Preço máx." htmlFor="mf-max"><Input id="mf-max" inputMode="decimal" defaultValue={f.max} onBlur={(e) => setF({ max: e.target.value.replace(/\D/g, '') })} /></FieldWrap>
          <FieldWrap label="Condição" htmlFor="mf-cond"><Select id="mf-cond" value={f.cond} onChange={(e) => setF({ condicao: e.target.value })}><option value="">Todas</option>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></FieldWrap>
          <FieldWrap label="Marca" htmlFor="mf-brand"><Input id="mf-brand" defaultValue={f.brand} onBlur={(e) => setF({ marca: e.target.value.trim() })} /></FieldWrap>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>{q.data ? `${q.data.count} anúncio(s)` : ''}</span>
        <Select aria-label="Ordenar" value={f.sort} onChange={(e) => setF({ ordem: e.target.value })} className="h-9 w-48"><option value="recentes">Mais recentes</option><option value="menor_preco">Menor preço</option><option value="maior_preco">Maior preço</option></Select>
      </div>
      {q.isLoading ? <LoadingRows rows={6} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.rows.length ? (
        <div className="card"><EmptyState icon={<Store className="h-6 w-6" />} title="Nenhum anúncio encontrado" description="Ajuste a busca ou os filtros — ou seja o primeiro a anunciar." action={<Button onClick={() => navigate('/marketplace/novo')}>Criar anúncio</Button>} /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {q.data.rows.map((l) => <ListingCardView key={l.id} l={l} fav={favs.set.has(l.id)} onFav={() => favs.toggle(l.id)} />)}
          </div>
          {pages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={f.page === 0} onClick={() => setF({ p: String(f.page - 1) })}>Anterior</Button>
              <span>Página {f.page + 1} de {pages}</span>
              <Button variant="outline" size="sm" disabled={f.page >= pages - 1} onClick={() => setF({ p: String(f.page + 1) })}>Próxima</Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
