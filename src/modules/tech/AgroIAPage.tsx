import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Database, Loader2 } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives'
import { formatArea, formatBRL, formatDate, formatNumber, toISODate, addDays } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'

interface Answer { question: string; text: ReactNode; sources: string[]; insufficient?: boolean }

/**
 * Consultas guiadas sobre os dados da conta (fase inicial da AgroIA).
 * Respostas determinísticas, calculadas a partir dos registros, sempre citando as tabelas usadas.
 * Nenhum dado é inventado; quando faltam registros, a resposta diz isso.
 */
export function AgroIAPage() {
  const { orgId, farmId, can } = useCurrentOrg()
  const [answers, setAnswers] = useState<Answer[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const scope = <T extends { eq: (c: string, v: string) => T }>(q: T) => (farmId ? q.eq('farm_id', farmId) : q)

  const QUESTIONS: { q: string; module: string; run: () => Promise<Omit<Answer, 'question'>> }[] = [
    {
      q: 'Quais contas vencem esta semana?', module: 'finance',
      run: async () => {
        const rows = await unwrap(scope(supabase.from('transactions').select('description, amount, kind, due_date').eq('organization_id', orgId).eq('status', 'pendente').lte('due_date', toISODate(addDays(new Date(), 7)))).order('due_date'))
        if (!rows.length) return { text: 'Não há contas pendentes vencidas ou com vencimento nos próximos 7 dias.', sources: ['Financeiro → lançamentos pendentes'] }
        const pay = rows.filter((r) => r.kind === 'despesa').reduce((s, r) => s + Number(r.amount), 0)
        const rec = rows.filter((r) => r.kind === 'receita').reduce((s, r) => s + Number(r.amount), 0)
        return { text: <><p>{rows.length} conta(s): a pagar {formatBRL(pay)}, a receber {formatBRL(rec)}.</p><ul className="mt-2 list-disc pl-5">{rows.slice(0, 8).map((r, i) => <li key={i}>{formatDate(r.due_date)} — {r.description}: {r.kind === 'despesa' ? '−' : '+'}{formatBRL(r.amount)}</li>)}</ul></>, sources: [`${rows.length} lançamento(s) pendente(s) do Financeiro`] }
      },
    },
    {
      q: 'Quanto gastei na última safra?', module: 'seasons',
      run: async () => {
        const seasons = await unwrap(scope(supabase.from('seasons').select('id, name, start_date, season_fields(planted_area_ha)').eq('organization_id', orgId).in('status', ['colhida', 'encerrada'])).order('start_date', { ascending: false }).limit(1))
        const s = seasons[0]
        if (!s) return { text: 'Não encontrei safra colhida ou encerrada. Atualize o status das safras para que eu possa responder.', sources: ['Safras'], insufficient: true }
        const [acts, txs] = await Promise.all([
          unwrap(supabase.from('activities').select('labor_cost, other_cost, inputs_cost').eq('season_id', s.id).neq('status', 'cancelada')),
          can('finance') ? unwrap(supabase.from('transactions').select('amount').eq('season_id', s.id).eq('kind', 'despesa').neq('status', 'cancelado')) : Promise.resolve([]),
        ])
        const op = acts.reduce((a, x) => a + Number(x.labor_cost) + Number(x.other_cost) + Number(x.inputs_cost), 0)
        const ex = (txs as { amount: number }[]).reduce((a, x) => a + Number(x.amount), 0)
        const area = (s.season_fields as { planted_area_ha: number | null }[]).reduce((a, x) => a + Number(x.planted_area_ha ?? 0), 0)
        return { text: <p>Na safra <strong>{s.name}</strong>: {formatBRL(op + ex)} ({formatBRL(op)} em operações e {formatBRL(ex)} em despesas lançadas na safra){area ? `, ou ${formatBRL((op + ex) / area)}/ha em ${formatArea(area)}` : ''}.</p>, sources: [`${acts.length} atividade(s) da safra`, `${(txs as unknown[]).length} despesa(s) vinculada(s)`] }
      },
    },
    {
      q: 'Qual talhão teve maior produtividade?', module: 'seasons',
      run: async () => {
        const rows = await unwrap(scope(supabase.from('harvest_records').select('quantity_kg, field_id, fields(name, area_ha, manual_area_ha), seasons(name, crops(sack_weight_kg))').eq('organization_id', orgId)))
        if (!rows.length) return { text: 'Ainda não há colheitas registradas. Registre colheitas nas safras para comparar produtividade.', sources: ['Colheitas'], insufficient: true }
        const m = new Map<string, { name: string; season: string; kg: number; area: number; sk: number | null }>()
        for (const r of rows) {
          const f = r.fields as { name: string; area_ha: number | null; manual_area_ha: number | null } | null
          const s = r.seasons as { name: string; crops: { sack_weight_kg: number | null } | null } | null
          const k = `${r.field_id}|${s?.name}`
          const cur = m.get(k) ?? { name: f?.name ?? '', season: s?.name ?? '', kg: 0, area: Number(f?.area_ha ?? f?.manual_area_ha ?? 0), sk: s?.crops?.sack_weight_kg ? Number(s.crops.sack_weight_kg) : null }
          cur.kg += Number(r.quantity_kg ?? 0); m.set(k, cur)
        }
        const ranked = [...m.values()].filter((x) => x.area > 0).map((x) => ({ ...x, yieldKg: x.kg / x.area })).sort((a, b) => b.yieldKg - a.yieldKg)
        const best = ranked[0]
        if (!best) return { text: 'Os talhões com colheita não têm área informada.', sources: ['Talhões'], insufficient: true }
        return { text: <p><strong>{best.name}</strong> na safra {best.season}: {best.sk ? `${formatNumber(best.yieldKg / best.sk, 1)} sc/ha` : `${formatNumber(best.yieldKg, 0)} kg/ha`}. {ranked.length > 1 && `Comparado a ${ranked.length - 1} outro(s) talhão/safra.`}</p>, sources: [`${rows.length} registro(s) de colheita`, 'Áreas dos talhões'] }
      },
    },
    {
      q: 'Quanto tenho disponível em estoque?', module: 'inventory',
      run: async () => {
        const rows = await unwrap(supabase.from('inventory_items').select('name, unit, current_quantity, average_cost, min_quantity').eq('organization_id', orgId).is('archived_at', null).order('name'))
        if (!rows.length) return { text: 'Nenhum item de estoque cadastrado.', sources: ['Estoque'], insufficient: true }
        const value = rows.reduce((a, r) => a + Number(r.current_quantity) * Number(r.average_cost), 0)
        const low = rows.filter((r) => r.min_quantity !== null && Number(r.current_quantity) <= Number(r.min_quantity))
        return { text: <><p>{rows.length} itens, valor total {formatBRL(value)} (custo médio).{low.length ? ` ${low.length} abaixo do mínimo: ${low.map((l) => l.name).join(', ')}.` : ''}</p><ul className="mt-2 list-disc pl-5">{rows.slice(0, 10).map((r) => <li key={r.name}>{r.name}: {formatNumber(r.current_quantity, 2)} {r.unit}</li>)}</ul></>, sources: [`${rows.length} item(ns) do Estoque (saldo por movimentações)`] }
      },
    },
    {
      q: 'Resumir atividades e pendências', module: 'activities',
      run: async () => {
        const [acts, tasks] = await Promise.all([
          unwrap(scope(supabase.from('activities').select('started_at, activity_types(name), fields(name)').eq('organization_id', orgId).gte('started_at', addDays(new Date(), -14).toISOString())).order('started_at', { ascending: false })),
          can('tasks') ? unwrap(scope(supabase.from('tasks').select('title, due_date, status').eq('organization_id', orgId).in('status', ['planejada', 'pendente', 'em_andamento'])).order('due_date')) : Promise.resolve([]),
        ])
        const late = (tasks as { due_date: string | null }[]).filter((t) => t.due_date && t.due_date < toISODate()).length
        return { text: <p>Nos últimos 14 dias: {acts.length} atividade(s) registradas ({[...new Set(acts.map((a) => (a.activity_types as { name: string } | null)?.name))].join(', ') || 'nenhuma'}). Pendências: {(tasks as unknown[]).length} tarefa(s) em aberto, {late} atrasada(s).</p>, sources: [`${acts.length} atividade(s) do Diário de campo`, `${(tasks as unknown[]).length} tarefa(s)`] }
      },
    },
    {
      q: 'Qual foi meu custo médio por hectare?', module: 'finance',
      run: async () => {
        const year = new Date().getFullYear()
        const [txs, farms] = await Promise.all([
          unwrap(scope(supabase.from('transactions').select('amount').eq('organization_id', orgId).eq('kind', 'despesa').neq('status', 'cancelado').gte('due_date', `${year}-01-01`).lte('due_date', `${year}-12-31`))),
          unwrap(supabase.from('farms').select('id, total_area_ha, productive_area_ha').eq('organization_id', orgId).is('archived_at', null)),
        ])
        const area = farms.filter((f) => !farmId || f.id === farmId).reduce((a, f) => a + Number(f.productive_area_ha ?? f.total_area_ha ?? 0), 0)
        const total = txs.reduce((a, t) => a + Number(t.amount), 0)
        if (!area) return { text: 'As propriedades não têm área produtiva/total informada.', sources: ['Propriedades'], insufficient: true }
        return { text: <p>Em {year}: despesas de {formatBRL(total)} sobre {formatArea(area)} = <strong>{formatBRL(total / area)}/ha</strong>.</p>, sources: [`${txs.length} despesa(s) de ${year}`, 'Área produtiva (ou total) das propriedades'] }
      },
    },
  ]

  const ask = async (item: (typeof QUESTIONS)[number]) => {
    setBusy(item.q)
    try {
      const a = await item.run()
      setAnswers((prev) => [{ question: item.q, ...a }, ...prev].slice(0, 10))
    } catch (e) {
      setAnswers((prev) => [{ question: item.q, text: `Não foi possível consultar: ${toUserMessage(e)}`, sources: [], insufficient: true }, ...prev])
    } finally { setBusy(null) }
  }

  return (
    <>
      <PageHeader title="AgroIA" crumbs={[{ label: 'Tecnologia' }, { label: 'AgroIA' }]} badge={<Badge tone="yellow">Consultas guiadas</Badge>}
        description="Respostas calculadas a partir dos registros da sua conta, sempre citando os dados usados. O assistente conversacional com IA generativa está previsto para a fase 8 e não inventa dados nem faz recomendações agronômicas." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Perguntas disponíveis" />
          <ul className="space-y-1 p-2">
            {QUESTIONS.filter((x) => can(x.module)).map((x) => (
              <li key={x.q}><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left" onClick={() => void ask(x)} disabled={!!busy}>
                {busy === x.q ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 shrink-0 text-brand-700" />}{x.q}
              </Button></li>
            ))}
          </ul>
        </Card>
        <div className="space-y-3" aria-live="polite">
          {!answers.length && <Card className="p-8 text-center text-sm text-muted">Escolha uma pergunta. As respostas usam apenas dados cadastrados na plataforma{farmId ? ' para a propriedade selecionada' : ''}.</Card>}
          {answers.map((a, i) => (
            <Card key={i} className="p-4">
              <div className="text-sm font-semibold">{a.question}</div>
              <div className="mt-2 text-sm">{a.text}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <Database className="h-3.5 w-3.5" />Dados usados: {a.sources.join(' · ') || '—'}
                {a.insufficient && <Badge tone="yellow">Informação insuficiente</Badge>}
              </div>
            </Card>
          ))}
          <p className="text-[11px] text-muted">Para interpretar análises de solo ou definir manejos, consulte o engenheiro agrônomo responsável. <Link to="/relatorios" className="underline">Ver relatórios completos</Link></p>
        </div>
      </div>
    </>
  )
}
