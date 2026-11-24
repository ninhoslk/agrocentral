# AgroCentral

Plataforma de gestão rural, clima, mercado e marketplace — *Sua fazenda, seus dados, suas decisões.*

Primeira versão construída a partir do documento **"Estrutura Base do Site e Plano de Implementação"** (com o Documento Mestre como referência), por etapas: fundação → fazenda → operação → financeiro → clima/mercado → marketplace → relatórios/PWA.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite, React Router, TanStack Query |
| Estilo | Tailwind CSS v4, Radix (diálogos/menus), lucide-react |
| Formulários | React Hook Form + Zod (validação no cliente; o banco valida de novo) |
| Backend | Supabase: Auth, PostgreSQL + PostGIS, Storage, Edge Functions (Deno), pg_cron + pg_net |
| Mapas | Leaflet + Geoman (desenho/edição), Turf (área/perímetro), togeojson/JSZip (KML/KMZ) |
| Gráficos | Recharts |
| PWA | vite-plugin-pwa (instalável; pré-cache só do núcleo) |
| Testes | Vitest (domínio) + Playwright (E2E desktop e celular) + testes de RLS em SQL |

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Testes:

```bash
npm test            # unitários (cálculos, unidades, financeiro, geo, mercado, manutenção)
npm run typecheck
npx playwright test # E2E — requer .env.test.local com E2E_USER_A/B_EMAIL e _PASSWORD
```

## Estrutura

```
src/
  app/          router, providers (auth, organização/permissões), layouts (menu, barra inferior do celular)
  components/   ui, forms (formulário dirigido por schema), tables (tabela/lista responsiva), maps, feedback
  modules/      dashboard, farms, fields, seasons, field-activities, tasks, team, finance, inventory, equipment,
                documents, weather, market, marketplace, calculators, reports, notifications, settings, tech
  services/     supabase (cliente + helpers), providers (adaptadores: clima, câmbio, IBGE, geocodificação)
  hooks/ lib/ utils/ types/
supabase/
  migrations/   schema completo, RLS, regras de negócio, dados demonstrativos, agendamentos
  functions/    weather (Open-Meteo), market-sync (BCB/SGS), geocode (Nominatim), send-invite
e2e/            testes Playwright (desktop e iPhone)
```

## Segurança

- Multi-organização desde o início; **RLS em todas as tabelas expostas**, por organização, propriedade e papel/módulo/ação.
- Regras críticas no banco (triggers): saldo de estoque só por movimentação (sem saldo negativo, FEFO por lote), colheita só em talhão da safra, categoria compatível com o tipo de lançamento, auditoria de alterações.
- Chaves secretas só nas Edge Functions; o navegador usa apenas a chave publicável.
- Documentos em bucket privado com URLs assinadas de 60 s; mídia de anúncios em bucket público com pasta por usuário.
- Cabeçalhos de segurança e CSP em `vercel.json`.

## Fontes de dados externas

| Dado | Fonte | Situação |
| --- | --- | --- |
| Previsão do tempo | Open-Meteo | Ativo (uso gratuito não comercial — contratar plano antes de vender) |
| Dólar/Euro | Banco Central do Brasil — SGS | Ativo (taxa de referência oficial) |
| UF/municípios | IBGE Localidades | Ativo |
| Geocodificação | Nominatim/OSM | Ativo (1 req/s, cache) |
| Avisos oficiais | INMET | Link para o portal oficial |
| Cotações agrícolas | CEPEA/CONAB | Não integrado (licença) — lançamento manual ou demonstrativo rotulado |
| Satélite/NDVI | Copernicus | Fase 8 |
