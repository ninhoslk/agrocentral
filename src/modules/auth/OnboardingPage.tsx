import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Check, LogOut } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOrg } from '@/app/providers/OrgProvider'
import { Button, Checkbox, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { UfCitySelect } from '@/components/forms/UfCitySelect'
import { AuthShell } from './AuthPages'

const CROPS = ['Soja', 'Milho', 'Café', 'Cana-de-açúcar', 'Algodão', 'Arroz', 'Trigo', 'Feijão', 'Pecuária', 'Hortifruti', 'Outra']

export function OnboardingPage() {
  const { user, signOut } = useAuth()
  const { orgs, loading, refresh, setOrgId } = useOrg()
  const [params] = useSearchParams()
  const creatingAnother = params.get('nova') === '1'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [org, setOrg] = useState({ name: '', uf: '', city: '', crop: '' })
  const [farm, setFarm] = useState({ name: '', uf: '', city: '', total: '', productive: '', tenure: 'propria', lat: '', lon: '' })
  const [demo, setDemo] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!loading && orgs.length > 0 && !creatingAnother) return <Navigate to="/" replace />

  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\./g, '').replace(',', '.')))

  const validateStep = () => {
    const e: Record<string, string> = {}
    if (step === 0) {
      if (org.name.trim().length < 2) e.orgName = 'Informe o nome do produtor ou da organização'
      if (!org.uf) e.orgUf = 'Selecione a UF'
      if (!org.city) e.orgCity = 'Selecione o município'
    }
    if (step === 1) {
      if (farm.name.trim().length < 2) e.farmName = 'Informe o nome da propriedade'
      const t = num(farm.total), p = num(farm.productive)
      if (farm.total && (t === null || !Number.isFinite(t) || t <= 0)) e.total = 'Área inválida'
      if (farm.productive && (p === null || !Number.isFinite(p) || p < 0)) e.productive = 'Área inválida'
      if (t && p && p > t) e.productive = 'Área produtiva não pode ser maior que a total'
      const la = num(farm.lat), lo = num(farm.lon)
      if (farm.lat && (la === null || la < -34 || la > 6)) e.lat = 'Latitude fora do Brasil'
      if (farm.lon && (lo === null || lo < -74 || lo > -28)) e.lon = 'Longitude fora do Brasil'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const finish = async () => {
    if (!validateStep()) return
    setBusy(true)
    try {
      const { data: orgId, error } = await supabase.rpc('create_organization', {
        p_name: org.name.trim(), p_city: org.city, p_state: org.uf, p_main_crop: org.crop || undefined,
        p_farm: {
          name: farm.name.trim(), city: farm.city || org.city, state: farm.uf || org.uf,
          total_area_ha: num(farm.total), productive_area_ha: num(farm.productive), tenure_type: farm.tenure,
          latitude: num(farm.lat), longitude: num(farm.lon),
        },
      })
      if (error) throw error
      if (demo) {
        const { error: e2 } = await supabase.rpc('seed_demo_data', { p_org: orgId as string })
        if (e2) toast.error(`Organização criada, mas os dados demonstrativos falharam: ${toUserMessage(e2)}`)
      }
      setOrgId(orgId as string)
      refresh()
      await qc.invalidateQueries()
      toast.success('Tudo pronto! Bem-vindo(a) à AgroCentral.')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const steps = ['Produtor / organização', 'Primeira propriedade', 'Preferências']
  return (
    <AuthShell title={creatingAnother ? 'Nova organização' : 'Vamos configurar sua conta'} subtitle={`Olá${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}! Leva menos de 2 minutos.`}
      footer={!creatingAnother && <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1 underline"><LogOut className="h-3.5 w-3.5" />Sair</button>}>
      <ol className="mb-6 flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
              i < step ? 'border-brand-700 bg-brand-700 text-white' : i === step ? 'border-brand-700 text-brand-800' : 'border-line text-muted')}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden sm:inline', i === step ? 'font-medium' : 'text-muted')}>{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <FieldWrap label="Nome do produtor ou da organização" htmlFor="org-name" required error={errors.orgName}>
            <Input id="org-name" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} maxLength={120} />
          </FieldWrap>
          <UfCitySelect uf={org.uf} city={org.city} onUf={(v) => setOrg((o) => ({ ...o, uf: v }))} onCity={(v) => setOrg((o) => ({ ...o, city: v }))} required errors={{ uf: errors.orgUf, city: errors.orgCity }} />
          <FieldWrap label="Cultura principal" htmlFor="crop">
            <Select id="crop" value={org.crop} onChange={(e) => setOrg({ ...org, crop: e.target.value })}>
              <option value="">—</option>
              {CROPS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </FieldWrap>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <FieldWrap label="Nome da propriedade" htmlFor="farm-name" required error={errors.farmName}>
            <Input id="farm-name" value={farm.name} onChange={(e) => setFarm({ ...farm, name: e.target.value })} placeholder="Ex.: Fazenda Santa Rita" />
          </FieldWrap>
          <UfCitySelect uf={farm.uf || org.uf} city={farm.city || (farm.uf ? '' : org.city)} onUf={(v) => setFarm((f) => ({ ...f, uf: v }))} onCity={(v) => setFarm((f) => ({ ...f, city: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Área total (ha)" htmlFor="total" error={errors.total}><Input id="total" inputMode="decimal" value={farm.total} onChange={(e) => setFarm({ ...farm, total: e.target.value })} /></FieldWrap>
            <FieldWrap label="Área produtiva (ha)" htmlFor="prod" error={errors.productive}><Input id="prod" inputMode="decimal" value={farm.productive} onChange={(e) => setFarm({ ...farm, productive: e.target.value })} /></FieldWrap>
          </div>
          <FieldWrap label="Tipo de posse" htmlFor="tenure">
            <Select id="tenure" value={farm.tenure} onChange={(e) => setFarm({ ...farm, tenure: e.target.value })}>
              <option value="propria">Própria</option><option value="arrendada">Arrendada</option><option value="parceria">Parceria</option><option value="comodato">Comodato</option><option value="outra">Outra</option>
            </Select>
          </FieldWrap>
          <details className="rounded-lg border border-line bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium">Coordenadas da sede (opcional)</summary>
            <p className="mt-2 text-xs text-muted">Usadas para previsão do tempo e alertas da propriedade. Você também pode desenhar os limites no mapa depois.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FieldWrap label="Latitude" htmlFor="lat" error={errors.lat}><Input id="lat" inputMode="decimal" placeholder="-17,79" value={farm.lat} onChange={(e) => setFarm({ ...farm, lat: e.target.value })} /></FieldWrap>
              <FieldWrap label="Longitude" htmlFor="lon" error={errors.lon}><Input id="lon" inputMode="decimal" placeholder="-50,92" value={farm.lon} onChange={(e) => setFarm({ ...farm, lon: e.target.value })} /></FieldWrap>
            </div>
          </details>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-line bg-white p-4">
            <Checkbox checked={demo} onChange={(e) => setDemo(e.target.checked)} label={<span className="font-medium">Adicionar dados demonstrativos</span>} />
            <p className="mt-2 text-xs text-muted">
              Cria uma fazenda fictícia completa (talhões, safras, atividades, estoque, máquinas e financeiro) para conhecer a plataforma.
              Todos os registros recebem o selo <strong>DADO DEMONSTRATIVO</strong> e podem ser removidos em Configurações → Organização.
            </p>
          </div>
          <p className="text-xs text-muted">Você poderá ajustar módulos, alertas, unidades e convidar colaboradores em Configurações.</p>
        </div>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>Voltar</Button>
        {step < 2 ? (
          <Button onClick={() => { if (validateStep()) setStep((s) => s + 1) }}>Continuar</Button>
        ) : (
          <Button onClick={() => void finish()} loading={busy}>Concluir</Button>
        )}
      </div>
    </AuthShell>
  )
}
