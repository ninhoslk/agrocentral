import * as RDialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrg } from '@/app/providers/OrgProvider'
import { supabase } from '@/services/supabase/client'
import { NAV } from '@/app/router/nav'
import { Spinner } from '@/components/ui/primitives'

interface Hit { group: string; label: string; sub?: string; to: string }

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim())
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const [active, setActive] = useState(0)

  useEffect(() => { if (!open) { setQ(''); setActive(0) } }, [open])

  const pages: Hit[] = useMemo(() => {
    if (!dq) return []
    const n = dq.toLowerCase()
    return NAV.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(n)).slice(0, 5).map((i) => ({ group: 'Páginas', label: i.label, to: i.to }))
  }, [dq])

  const results = useQuery({
    queryKey: ['global-search', org?.id, dq],
    enabled: open && !!org && dq.length >= 2,
    queryFn: async () => {
      const like = `%${dq.replace(/[%_]/g, '')}%`
      const orgId = org!.id
      const jobs: Promise<Hit[]>[] = []
      if (can('farms')) jobs.push(Promise.resolve(supabase.from('farms').select('id, name, city').eq('organization_id', orgId).ilike('name', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Propriedades', label: r.name, sub: r.city ?? undefined, to: `/propriedades/${r.id}` }))))
      if (can('fields')) jobs.push(Promise.resolve(supabase.from('fields').select('id, name, code').eq('organization_id', orgId).or(`name.ilike.${like},code.ilike.${like}`).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Talhões', label: r.name, sub: r.code ?? undefined, to: `/talhoes/${r.id}` }))))
      if (can('seasons')) jobs.push(Promise.resolve(supabase.from('seasons').select('id, name').eq('organization_id', orgId).ilike('name', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Safras', label: r.name, to: `/safras/${r.id}` }))))
      if (can('equipment')) jobs.push(Promise.resolve(supabase.from('equipment').select('id, name, model').eq('organization_id', orgId).ilike('name', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Máquinas', label: r.name, sub: r.model ?? undefined, to: `/maquinas/${r.id}` }))))
      if (can('inventory')) jobs.push(Promise.resolve(supabase.from('inventory_items').select('id, name, category').eq('organization_id', orgId).ilike('name', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Estoque', label: r.name, sub: r.category, to: `/estoque?item=${r.id}` }))))
      if (can('team')) jobs.push(Promise.resolve(supabase.from('employees').select('id, full_name, role_title').eq('organization_id', orgId).ilike('full_name', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Equipe', label: r.full_name, sub: r.role_title ?? undefined, to: '/equipe' }))))
      if (can('documents')) jobs.push(Promise.resolve(supabase.from('documents').select('id, name, doc_type').eq('organization_id', orgId).ilike('name', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Documentos', label: r.name, sub: r.doc_type, to: `/documentos?q=${encodeURIComponent(r.name)}` }))))
      if (can('finance')) jobs.push(Promise.resolve(supabase.from('transactions').select('id, description, amount').eq('organization_id', orgId).ilike('description', like).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Financeiro', label: r.description, sub: `R$ ${Number(r.amount).toLocaleString('pt-BR')}`, to: `/financeiro?q=${encodeURIComponent(r.description)}` }))))
      jobs.push(Promise.resolve(supabase.from('listings').select('id, title, city, state').eq('status', 'publicado').textSearch('search_vector', dq, { type: 'websearch', config: 'portuguese' }).limit(5)).then(({ data }) => (data ?? []).map((r) => ({ group: 'Marketplace', label: r.title, sub: `${r.city}/${r.state}`, to: `/marketplace/anuncio/${r.id}` }))))
      return (await Promise.all(jobs)).flat()
    },
  })

  const hits = [...pages, ...(results.data ?? [])]
  const go = (h: Hit) => { onOpenChange(false); navigate(h.to) }

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[1000] bg-black/40" />
        <RDialog.Content className="fixed left-1/2 top-[10vh] z-[1001] w-[94vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
          <RDialog.Title className="sr-only">Busca global</RDialog.Title>
          <RDialog.Description className="sr-only">Pesquise propriedades, talhões, safras, máquinas, estoque, documentos e anúncios</RDialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="h-4 w-4 text-muted" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
                if (e.key === 'Enter' && hits[active]) go(hits[active])
              }}
              placeholder="Buscar propriedades, talhões, máquinas, documentos…" aria-label="Termo de busca"
              className="h-12 flex-1 bg-transparent text-sm outline-none" />
            {results.isFetching && <Spinner label="Buscando" />}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
            {dq.length >= 2 && !results.isFetching && hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nenhum resultado.</li>}
            {dq.length < 2 && <li className="px-3 py-6 text-center text-sm text-muted">Digite ao menos 2 caracteres.</li>}
            {hits.map((h, i) => (
              <li key={`${h.group}-${h.to}-${i}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === active ? 'bg-brand-50' : ''}`}>
                  <span className="min-w-0"><span className="block truncate font-medium">{h.label}</span>{h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}</span>
                  <span className="shrink-0 text-xs text-muted">{h.group}</span>
                </button>
              </li>
            ))}
          </ul>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
