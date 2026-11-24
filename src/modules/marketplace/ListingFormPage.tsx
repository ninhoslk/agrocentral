import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Button, Card, CardHeader, Checkbox, FieldWrap, Input, Select, Textarea } from '@/components/ui/primitives'
import { ErrorState, LoadingRows } from '@/components/feedback/states'
import { UfCitySelect } from '@/components/forms/UfCitySelect'
import { cn } from '@/lib/cn'
import { toUserMessage } from '@/lib/errors'
import { compressImage } from '@/utils/image'
import { CONDITIONS, mediaUrl, priceLabel, SAFETY_TIPS, useCategories } from './shared'

interface Photo { id?: string; path?: string; file?: File; preview: string }
const MAX_PHOTOS = 10
const MACHINE_CATS = ['maquinas', 'tratores', 'colheitadeiras', 'pulverizadores', 'plantadeiras', 'implementos', 'maquinas_diversas', 'veiculos']

export function ListingFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { org, profile } = useOrg()
  const qc = useQueryClient()
  const cats = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [removed, setRemoved] = useState<Photo[]>([])
  const [v, setV] = useState({
    category_id: '', title: '', description: '', price: '', currency: 'BRL', price_unit: '', negotiable: true, condition: 'usado',
    quantity: '', unit: '', state: '', city: '', brand: '', model: '', year: '', hours_used: '', seller_name: '', show_phone: false, contact_phone: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const existing = useQuery({ queryKey: ['listing', id], enabled: !!id, queryFn: () => unwrap(supabase.from('listings').select('*, listing_media(id, storage_path, position)').eq('id', id!).single()) })
  useEffect(() => {
    const d = existing.data
    if (d) {
      setV({
        category_id: d.category_id, title: d.title, description: d.description, price: d.price ? String(d.price).replace('.', ',') : '', currency: d.currency,
        price_unit: d.price_unit ?? '', negotiable: d.negotiable, condition: d.condition, quantity: d.quantity ? String(d.quantity) : '', unit: d.unit ?? '',
        state: d.state, city: d.city, brand: d.brand ?? '', model: d.model ?? '', year: d.year ? String(d.year) : '', hours_used: d.hours_used ? String(d.hours_used) : '',
        seller_name: d.seller_name, show_phone: d.show_phone, contact_phone: d.contact_phone ?? '',
      })
      setPhotos([...(d.listing_media ?? [])].sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, path: m.storage_path, preview: mediaUrl(m.storage_path) })))
    } else if (!id) {
      setV((x) => ({ ...x, seller_name: profile?.full_name ?? org?.name ?? '', state: org?.state ?? '', city: org?.city ?? '', contact_phone: profile?.phone ?? '' }))
    }
  }, [existing.data, id, profile, org])

  const roots = (cats.data ?? []).filter((c) => !c.parent_id)
  const subs = (cats.data ?? []).filter((c) => c.parent_id)
  const selectedCat = cats.data?.find((c) => c.id === v.category_id)
  const restricted = selectedCat?.restricted_note ?? cats.data?.find((c) => c.id === selectedCat?.parent_id)?.restricted_note
  const isMachine = MACHINE_CATS.includes(v.category_id)
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\./g, '').replace(',', '.')))

  const validate = (s = step) => {
    const e: Record<string, string> = {}
    if (s >= 0 && !v.category_id) e.category_id = 'Escolha a categoria'
    if (s >= 1) {
      if (v.title.trim().length < 5) e.title = 'Título com ao menos 5 caracteres'
      if (v.description.trim().length < 10) e.description = 'Descreva o item (mín. 10 caracteres)'
      const p = num(v.price); if (v.price && (p === null || !Number.isFinite(p) || p <= 0)) e.price = 'Preço inválido'
      if (!v.state) e.state = 'UF obrigatória'
      if (!v.city.trim()) e.city = 'Município obrigatório'
      if (v.year && (Number(v.year) < 1900 || Number(v.year) > 2100)) e.year = 'Ano inválido'
      if (v.seller_name.trim().length < 2) e.seller_name = 'Informe o nome exibido'
      if (v.show_phone && !/^[\d\s()+-]{8,20}$/.test(v.contact_phone)) e.contact_phone = 'Telefone inválido'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length)
    for (const f of list) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error(`${f.name}: use JPG, PNG ou WEBP`); continue }
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: arquivo muito grande`); continue }
      setPhotos((p) => [...p, { file: f, preview: URL.createObjectURL(f) }])
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = async (publish: boolean) => {
    if (!validate(2)) { setStep(1); toast.error('Revise os campos destacados'); return }
    setSaving(true)
    try {
      const row = {
        category_id: v.category_id, title: v.title.trim(), description: v.description.trim(), price: num(v.price), currency: v.currency,
        price_unit: v.price_unit.trim() || null, negotiable: v.negotiable, condition: v.condition, quantity: num(v.quantity), unit: v.unit.trim() || null,
        state: v.state, city: v.city.trim(), brand: v.brand.trim() || null, model: v.model.trim() || null, year: v.year ? Number(v.year) : null,
        hours_used: num(v.hours_used), seller_name: v.seller_name.trim(), show_phone: v.show_phone, contact_phone: v.show_phone ? v.contact_phone.trim() : null,
        organization_id: org?.id ?? null,
      }
      let listingId = id
      if (id) {
        const status = publish ? 'publicado' : existing.data?.status === 'publicado' ? 'publicado' : 'rascunho'
        await unwrap(supabase.from('listings').update({ ...row, status }).eq('id', id))
      } else {
        const created = await unwrap(supabase.from('listings').insert({ ...row, seller_id: user!.id, status: 'rascunho' }).select('id').single())
        listingId = created.id
      }
      // fotos removidas
      for (const r of removed) {
        if (r.id) await unwrap(supabase.from('listing_media').delete().eq('id', r.id))
        if (r.path) await supabase.storage.from('listing-media').remove([r.path])
      }
      // novas fotos (comprimidas) + ordem
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        if (p.file) {
          const blob = await compressImage(p.file)
          const path = `${user!.id}/${listingId}/${crypto.randomUUID()}.webp`
          const up = await supabase.storage.from('listing-media').upload(path, blob, { contentType: 'image/webp' })
          if (up.error) throw up.error
          await unwrap(supabase.from('listing_media').insert({ listing_id: listingId!, seller_id: user!.id, storage_path: path, position: i }))
        } else if (p.id) {
          await unwrap(supabase.from('listing_media').update({ position: i }).eq('id', p.id))
        }
      }
      if (!id && publish) await unwrap(supabase.from('listings').update({ status: 'publicado' }).eq('id', listingId!))
      qc.invalidateQueries({ queryKey: ['listing'] }); qc.invalidateQueries({ queryKey: ['mp-mine'] }); qc.invalidateQueries({ queryKey: ['mp-search'] })
      toast.success(publish ? 'Anúncio publicado' : 'Rascunho salvo')
      navigate(publish ? `/marketplace/anuncio/${listingId}` : '/marketplace/meus-anuncios')
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally { setSaving(false) }
  }

  const steps = ['Categoria', 'Detalhes', 'Fotos', 'Prévia']
  const previewCover = useMemo(() => photos[0]?.preview, [photos])
  if (id && existing.isLoading) return <LoadingRows rows={8} />
  if (id && existing.error) return <ErrorState error={existing.error} />
  if (existing.data && existing.data.seller_id !== user?.id) return <ErrorState error={{ code: '42501' }} />

  const err = (k: string) => errors[k]
  return (
    <>
      <PageHeader title={id ? 'Editar anúncio' : 'Novo anúncio'} crumbs={[{ label: 'Negócios' }, { label: 'Marketplace', to: '/marketplace' }, { label: id ? 'Editar' : 'Novo' }]} />
      <ol className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 text-sm scrollbar-thin sm:mx-0 sm:mb-5 sm:flex-wrap sm:px-0" aria-label="Etapas do anúncio">
        {steps.map((s, i) => (
          <li key={s} className="shrink-0"><button type="button" onClick={() => { if (i <= step || validate(i - 1)) setStep(i) }}
            className={cn('min-h-10 whitespace-nowrap rounded-full border px-3.5', i === step ? 'border-brand-700 bg-brand-800 text-white' : i < step ? 'border-brand-200 bg-brand-50' : 'border-line bg-white text-muted')} aria-current={i === step ? 'step' : undefined}>{s}</button></li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="p-3 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roots.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-3">
                <button type="button" onClick={() => setV({ ...v, category_id: r.id })} className={cn('min-h-11 w-full rounded-lg px-2 text-left text-sm font-medium sm:min-h-9', v.category_id === r.id && 'bg-brand-800 text-white')}>{r.name}</button>
                {subs.filter((s) => s.parent_id === r.id).map((s) => (
                  <button key={s.id} type="button" onClick={() => setV({ ...v, category_id: s.id })} className={cn('mt-1 block min-h-10 w-full rounded-lg px-2 text-left text-sm text-muted hover:bg-surface sm:min-h-8', v.category_id === s.id && 'bg-brand-800 text-white')}>{s.name}</button>
                ))}
              </div>
            ))}
          </div>
          {err('category_id') && <p className="mt-2 text-sm text-danger">{err('category_id')}</p>}
          {restricted && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{restricted}</p>}
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4 p-5">
          <FieldWrap label="Título" htmlFor="l-title" required error={err('title')}><Input id="l-title" maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex.: Trator 4x4 110 cv, 2018, 4.200 h" /></FieldWrap>
          <FieldWrap label="Descrição" htmlFor="l-desc" required error={err('description')} hint={`${v.description.length}/5000`}><Textarea id="l-desc" maxLength={5000} rows={6} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></FieldWrap>
          <div className="grid gap-4 sm:grid-cols-4">
            <FieldWrap label="Preço" htmlFor="l-price" error={err('price')} hint="Vazio = a combinar"><Input id="l-price" inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></FieldWrap>
            <FieldWrap label="Moeda" htmlFor="l-cur"><Select id="l-cur" value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}><option value="BRL">R$</option><option value="USD">US$</option></Select></FieldWrap>
            <FieldWrap label="Preço por" htmlFor="l-pu" hint="Ex.: saca, t, hora, km"><Input id="l-pu" maxLength={20} value={v.price_unit} onChange={(e) => setV({ ...v, price_unit: e.target.value })} /></FieldWrap>
            <div className="flex items-end pb-2"><Checkbox label="Aceita negociar" checked={v.negotiable} onChange={(e) => setV({ ...v, negotiable: e.target.checked })} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <FieldWrap label="Condição" htmlFor="l-cond"><Select id="l-cond" value={v.condition} onChange={(e) => setV({ ...v, condition: e.target.value })}>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></FieldWrap>
            <FieldWrap label="Quantidade" htmlFor="l-qty"><Input id="l-qty" inputMode="decimal" value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} /></FieldWrap>
            <FieldWrap label="Unidade" htmlFor="l-unit"><Input id="l-unit" maxLength={20} value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} placeholder="un, sc, t…" /></FieldWrap>
          </div>
          {isMachine && (
            <div className="grid gap-4 sm:grid-cols-4">
              <FieldWrap label="Marca" htmlFor="l-brand"><Input id="l-brand" maxLength={60} value={v.brand} onChange={(e) => setV({ ...v, brand: e.target.value })} /></FieldWrap>
              <FieldWrap label="Modelo" htmlFor="l-model"><Input id="l-model" maxLength={60} value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} /></FieldWrap>
              <FieldWrap label="Ano" htmlFor="l-year" error={err('year')}><Input id="l-year" inputMode="numeric" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></FieldWrap>
              <FieldWrap label="Horas de uso" htmlFor="l-hours"><Input id="l-hours" inputMode="decimal" value={v.hours_used} onChange={(e) => setV({ ...v, hours_used: e.target.value })} /></FieldWrap>
            </div>
          )}
          <UfCitySelect uf={v.state} city={v.city} onUf={(s) => setV((x) => ({ ...x, state: s }))} onCity={(c) => setV((x) => ({ ...x, city: c }))} required errors={{ uf: err('state'), city: err('city') }} />
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldWrap label="Nome exibido" htmlFor="l-seller" required error={err('seller_name')}><Input id="l-seller" maxLength={120} value={v.seller_name} onChange={(e) => setV({ ...v, seller_name: e.target.value })} /></FieldWrap>
            <div className="flex items-end pb-2"><Checkbox label="Exibir telefone para usuários logados" checked={v.show_phone} onChange={(e) => setV({ ...v, show_phone: e.target.checked })} /></div>
            {v.show_phone && <FieldWrap label="Telefone" htmlFor="l-phone" error={err('contact_phone')}><Input id="l-phone" maxLength={20} value={v.contact_phone} onChange={(e) => setV({ ...v, contact_phone: e.target.value })} /></FieldWrap>}
          </div>
          <p className="text-xs text-muted">Por privacidade, exibimos apenas município/UF. O telefone só aparece se você permitir.</p>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5">
          <p className="mb-3 text-sm text-muted">Até {MAX_PHOTOS} fotos (JPG, PNG ou WEBP). As imagens são redimensionadas e comprimidas antes do envio. A primeira é a capa.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((p, i) => (
              <div key={p.preview} className="relative aspect-square overflow-hidden rounded-lg border border-line">
                <img src={p.preview} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1">
                  <button type="button" aria-label="Tornar capa" disabled={i === 0} onClick={() => setPhotos((ps) => [ps[i], ...ps.filter((_, j) => j !== i)])} className="rounded p-1 text-white disabled:opacity-40"><Star className={cn('h-4 w-4', i === 0 && 'fill-wheat-400 text-wheat-400')} /></button>
                  <button type="button" aria-label="Remover foto" onClick={() => { setPhotos((ps) => ps.filter((_, j) => j !== i)); if (p.id) setRemoved((r) => [...r, p]) }} className="rounded p-1 text-white"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-sm text-muted hover:border-brand-400">
                <ImagePlus className="h-6 w-6" />Adicionar
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
        </Card>
      )}

      {step === 3 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title="Prévia do anúncio" />
            <div className="p-5">
              {previewCover && <img src={previewCover} alt="" className="mb-4 aspect-[16/10] w-full rounded-lg object-cover" />}
              <h2 className="text-xl font-semibold">{v.title || 'Sem título'}</h2>
              <div className="mt-1 text-lg font-semibold text-brand-900">{priceLabel({ price: num(v.price), currency: v.currency, price_unit: v.price_unit || null, negotiable: v.negotiable })}</div>
              <div className="text-sm text-muted">{v.city}/{v.state} · {CONDITIONS.find((c) => c.value === v.condition)?.label} · {selectedCat?.name}</div>
              <p className="mt-4 whitespace-pre-wrap text-sm">{v.description}</p>
            </div>
          </Card>
          <Card className="h-fit bg-amber-50/60 p-4 text-xs text-amber-900">
            <p className="mb-2 font-semibold">Ao publicar, você declara que:</p>
            <ul className="list-disc space-y-1 pl-4">{SAFETY_TIPS.map((t) => <li key={t}>{t}</li>)}<li>As informações são verdadeiras e o item pode ser comercializado legalmente.</li></ul>
            <p className="mt-2">O anúncio fica publicado por 60 dias e pode ser pausado, editado ou encerrado a qualquer momento.</p>
          </Card>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}><ArrowLeft className="h-4 w-4" />{step === 0 ? 'Cancelar' : 'Voltar'}</Button>
        <div className="flex gap-2">
          {step >= 1 && <Button variant="outline" loading={saving} onClick={() => void save(false)}>Salvar rascunho</Button>}
          {step < 3 ? <Button onClick={() => { if (validate(step)) setStep(step + 1) }}>Continuar<ArrowRight className="h-4 w-4" /></Button>
            : <Button loading={saving} onClick={() => void save(true)}>Publicar anúncio</Button>}
        </div>
      </div>
    </>
  )
}
