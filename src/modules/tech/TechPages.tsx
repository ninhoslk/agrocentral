import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Radar } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Card, CardHeader } from '@/components/ui/primitives'
import { FarmMap } from '@/components/maps/FarmMap'
import { EmptyState } from '@/components/feedback/states'
import { formatDateTime, relativeTime } from '@/lib/format'
import { useFarm, useFarmFields } from '@/modules/farms/useFarmData'
import type { PolyGeom } from '@/utils/geo'

const SOURCES = [
  { provider: 'open-meteo', name: 'Open-Meteo', use: 'Previsão do tempo horária/diária e estimativa de chuva', status: 'ativo', note: 'Gratuito para uso não comercial (CC BY 4.0). Uso comercial exige plano/autorização.', url: 'https://open-meteo.com/en/terms' },
  { provider: 'bcb_sgs', name: 'Banco Central — SGS', use: 'Dólar e euro (séries oficiais diárias)', status: 'ativo', note: 'Dados abertos oficiais. Taxa de referência, não preço negociável.', url: 'https://www.bcb.gov.br/' },
  { provider: 'nominatim', name: 'Nominatim / OpenStreetMap', use: 'Geocodificação pontual de endereços', status: 'ativo', note: '1 req/s, cache e atribuição; sem autocomplete.', url: 'https://operations.osmfoundation.org/policies/nominatim/' },
  { provider: 'ibge', name: 'IBGE — Localidades', use: 'Lista oficial de UFs e municípios', status: 'ativo', note: 'API pública oficial consultada diretamente pelo navegador.', url: 'https://servicodados.ibge.gov.br/api/docs/localidades' },
  { provider: 'tiles', name: 'OpenStreetMap + Esri World Imagery', use: 'Mapa base e imagem de satélite de referência', status: 'ativo', note: 'Servidores públicos sem SLA; para produção, contratar provedor de tiles.', url: 'https://operations.osmfoundation.org/policies/tiles/' },
  { provider: 'inmet', name: 'INMET — avisos', use: 'Avisos meteorológicos oficiais', status: 'link', note: 'Exibido como link oficial até validação de endpoint e autorização.', url: 'https://alertas2.inmet.gov.br/' },
  { provider: 'cepea', name: 'CEPEA / CONAB', use: 'Cotações agrícolas por praça', status: 'não integrado', note: 'API comercial contratada (CEPEA) / restrição de uso comercial (CONAB). Use lançamento manual.', url: 'https://onetoone.cepea.org.br/termocontratacao-regulamentoapi/' },
  { provider: 'copernicus', name: 'Copernicus Data Space (Sentinel-2)', use: 'Imagens e índices de vegetação (NDVI)', status: 'fase 8', note: 'Requer conta, processamento e controle de nuvens.', url: 'https://documentation.dataspace.copernicus.eu/APIs.html' },
  { provider: 'push', name: 'Web Push (VAPID)', use: 'Notificações push no navegador/PWA', status: 'fase 7', note: 'Notificações internas e em tempo real já funcionam; push depende de consentimento e testes em dispositivos.', url: 'https://developer.mozilla.org/docs/Web/API/Push_API' },
]
const TONE: Record<string, 'green' | 'blue' | 'yellow' | 'neutral'> = { ativo: 'green', link: 'blue', 'não integrado': 'neutral', 'fase 8': 'yellow', 'fase 7': 'yellow' }

export function IntegrationsPage() {
  const status = useQuery({ queryKey: ['integration-status'], refetchInterval: 60_000, queryFn: () => unwrap(supabase.from('integration_status').select('*')) })
  const byProvider = new Map((status.data ?? []).map((s) => [s.provider, s]))
  return (
    <>
      <PageHeader title="Sensores e integrações" crumbs={[{ label: 'Tecnologia' }, { label: 'Integrações' }]}
        description="Fontes externas, situação da última chamada e restrições de uso. Cada adaptador pode ser substituído sem alterar as telas." />
      <Card>
        <CardHeader title="Fontes de dados" />
        <ul className="divide-y divide-line">
          {SOURCES.map((s) => {
            const st = byProvider.get(s.provider)
            return (
              <li key={s.provider} className="grid gap-2 px-5 py-3 text-sm md:grid-cols-[220px_1fr_220px]">
                <div><div className="font-medium">{s.name}</div><Badge tone={TONE[s.status]}>{s.status}</Badge></div>
                <div><div>{s.use}</div><div className="text-xs text-muted">{s.note} <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 underline">termos/documentação<ExternalLink className="h-3 w-3" /></a></div></div>
                <div className="text-xs text-muted">
                  {st ? <>Última chamada: <Badge tone={st.status === 'error' ? 'red' : 'green'}>{st.status === 'cache_hit' ? 'cache' : st.status}</Badge> {relativeTime(st.at)}{st.duration_ms ? ` · ${st.duration_ms} ms` : ''}{st.error && <div className="text-danger">{st.error}</div>}</> : 'Sem chamadas registradas'}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
      <Card className="mt-5">
        <CardHeader title="Sensores, estações e máquinas conectadas" />
        <EmptyState icon={<Radar className="h-6 w-6" />} title="Nenhum sensor conectado" description="A integração com estações meteorológicas, sondas de umidade, telemetria de máquinas e drones está prevista para a fase 8 (Inteligência). A estrutura de dados já registra fonte, horário e status de cada leitura externa." />
      </Card>
    </>
  )
}

export function SatellitePage() {
  const { farmId, farms } = useCurrentOrg()
  const id = farmId ?? farms[0]?.id
  const farm = useFarm(id)
  const fields = useFarmFields(id)
  return (
    <>
      <PageHeader title="Monitoramento por satélite" crumbs={[{ label: 'Tecnologia' }, { label: 'Satélite' }]} badge={<Badge tone="yellow">Fase 8 — não ativo</Badge>}
        description="O monitoramento de vegetação (NDVI) com Sentinel-2/Copernicus ainda não está integrado. Abaixo, a imagem de satélite é apenas referência visual de data desconhecida." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {id ? <FarmMap boundary={farm.data?.boundary_geojson as PolyGeom | null} fields={(fields.data ?? []).map((f) => ({ id: f.id, name: f.name, geometry: f.geojson as PolyGeom | null, color: f.color }))} height={460} fitKey={id} /> : <div className="card"><EmptyState title="Cadastre uma propriedade" /></div>}
        <Card>
          <CardHeader title="O que já está preparado" />
          <ul className="list-disc space-y-2 p-5 pl-9 text-sm">
            <li>Geometrias de propriedades e talhões em PostGIS (SRID 4326), com área e histórico.</li>
            <li>Camada de satélite de referência para desenho de limites.</li>
            <li>Estrutura de rastreabilidade de dados externos (fonte, coleta, validade, status).</li>
          </ul>
          <CardHeader title="Próximos passos" className="border-t" />
          <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-muted">
            <li>Conta no Copernicus Data Space e processamento server-side (Sentinel Hub/Process API).</li>
            <li>Séries de NDVI por talhão com máscara de nuvens e data da cena.</li>
            <li>Índices indicam áreas para inspeção — não diagnosticam causa de estresse, praga ou deficiência.</li>
          </ul>
          <p className="px-5 pb-5 text-xs text-muted">Atualizado em {formatDateTime(new Date().toISOString())}</p>
        </Card>
      </div>
    </>
  )
}
