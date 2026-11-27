import { useMemo, useState } from 'react'
import { ChevronDown, Copy, HandCoins, MoreVertical, Pencil, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { supabase } from '@/services/supabase/client'
import { useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { Badge, Button, Input } from '@/components/ui/primitives'
import { Dropdown, useConfirm } from '@/components/ui/overlay'
import { EmptyState } from '@/components/feedback/states'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { formatBRL, formatDate, formatNumber } from '@/lib/format'
import { lineTotal } from '@/lib/budget'
import { STATUS } from './config'
import { BUDGET_KEYS, type LineRow } from './useBudgetData'

const n = (v: unknown) => Number(v ?? 0)
const parse = (s: string) => Number(s.replace(/\./g, (m, _i, str: string) => (str.includes(',') ? '' : m)).replace(',', '.'))

function Progress({ planned, realized }: { planned: number; realized: number }) {
  const pct = planned > 0 ? (realized / planned) * 100 : realized > 0 ? 100 : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]" role="img" aria-label={`Executado ${formatNumber(pct, 0)}%`}>
      <div className={cn('h-full rounded-full', pct > 100 ? 'bg-danger' : pct >= 100 ? 'bg-ok' : 'bg-brand-600')} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

/** Célula editável estilo planilha: salva ao sair do campo ou com Enter. */
function CellInput({ value, onCommit, label, disabled }: { value: number; onCommit: (v: number) => void; label: string; disabled?: boolean }) {
  const fmt = (v: number) => formatNumber(v, 4)
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = parse(draft)
    setDraft(null)
    if (Number.isFinite(v) && v >= 0 && v !== value) onCommit(v)
  }
  return (
    <input aria-label={label} disabled={disabled} inputMode="decimal" value={draft ?? fmt(value)}
      onFocus={(e) => { setDraft(String(value).replace('.', ',')); requestAnimationFrame(() => e.target.select()) }}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDraft(null) }}
      className="h-8 w-24 rounded-md border border-transparent bg-transparent px-1.5 text-right tabular hover:border-line focus:border-brand-500 focus:bg-white focus:outline-none disabled:hover:border-transparent" />
  )
}

export function MicroView({ lines, kind, setKind, onEdit, onRealize, onDuplicate, names, financeAccess }: {
  lines: LineRow[]
  kind: 'despesa' | 'receita'
  setKind: (k: 'despesa' | 'receita') => void
  onEdit: (l: LineRow) => void
  onRealize: (l: LineRow) => void
  onDuplicate: (l: LineRow) => void
  names: { season: (id: string | null) => string; field: (id: string | null) => string }
  financeAccess: boolean
}) {
  const { can } = useCurrentOrg()
  const desktop = useIsDesktop()
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const { confirm, node } = useConfirm()
  const canEdit = can('budget', 'edit')

  const patch = useAppMutation(async ({ id, ...v }: { id: string } & Record<string, unknown>) => {
    const { error } = await supabase.from('budget_lines').update(v as never).eq('id', id)
    if (error) throw error
  }, { invalidate: BUDGET_KEYS })
  const remove = useAppMutation(async (id: string) => {
    const { error } = await supabase.from('budget_lines').delete().eq('id', id)
    if (error) throw error
  }, { invalidate: BUDGET_KEYS, success: 'Linha excluída' })

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return lines.filter((l) => l.kind === kind && (!needle || `${l.description} ${l.subcategory ?? ''} ${l.category_name}`.toLowerCase().includes(needle)))
  }, [lines, kind, q])
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: LineRow[]; planned: number; realized: number }>()
    for (const l of visible) {
      const g = m.get(l.category_id) ?? { name: l.category_name, rows: [], planned: 0, realized: 0 }
      g.rows.push(l)
      if (l.status !== 'cancelado') { g.planned += n(l.total_amount); g.realized += n(l.realized_amount) }
      m.set(l.category_id, g)
    }
    return [...m.entries()].sort((a, b) => b[1].planned - a[1].planned)
  }, [visible])
  const totPlanned = groups.reduce((a, [, g]) => a + g.planned, 0)
  const totRealized = groups.reduce((a, [, g]) => a + g.realized, 0)

  const del = async (l: LineRow) => {
    if (await confirm('Excluir linha do orçamento?', l.tx_count ? `Há ${l.tx_count} lançamento(s) no Financeiro vinculados; eles serão mantidos, apenas sem vínculo.` : 'Esta ação não pode ser desfeita.', 'Excluir')) remove.mutate(l.id)
  }
  const menu = (l: LineRow) => [
    ...(canEdit ? [{ label: 'Editar', icon: <Pencil className="h-4 w-4" />, onSelect: () => onEdit(l) }] : []),
    ...(financeAccess && can('finance', 'create') && l.status !== 'cancelado' ? [{ label: l.kind === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento', icon: <HandCoins className="h-4 w-4" />, onSelect: () => onRealize(l) }] : []),
    ...(can('budget', 'create') ? [{ label: 'Duplicar', icon: <Copy className="h-4 w-4" />, onSelect: () => onDuplicate(l) }] : []),
    ...(can('budget', 'delete') ? ['separator' as const, { label: 'Excluir', icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => void del(l) }] : []),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-lg bg-black/[0.05] p-1">
          {(['despesa', 'receita'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} type="button" onClick={() => setKind(k)}
              className={cn('min-h-9 rounded-md px-4 text-sm font-medium', kind === k ? 'bg-white text-ink shadow-sm' : 'text-muted')}>
              {k === 'despesa' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no orçamento…" className="pl-9" aria-label="Buscar no orçamento" />
        </div>
      </div>

      {!groups.length ? (
        <EmptyState title={kind === 'despesa' ? 'Nenhuma despesa orçada' : 'Nenhuma receita prevista'}
          description={kind === 'despesa' ? 'Comece pelas maiores despesas da safra: sementes, fertilizantes, defensivos e combustível. Quantidade × valor unitário é calculado automaticamente.' : 'Informe a produção esperada (ex.: sacas) e o preço previsto para calcular resultado, margem e ponto de equilíbrio.'} />
      ) : desktop ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-xs text-muted">
              <tr className="border-b border-line text-left">
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">Safra / talhão</th>
                <th className="px-3 py-2 font-medium">Data prevista</th>
                <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                <th className="px-2 py-2 font-medium">Un.</th>
                <th className="px-3 py-2 text-right font-medium">Valor unit.</th>
                <th className="px-3 py-2 text-right font-medium">Total orçado</th>
                <th className="px-3 py-2 text-right font-medium">Realizado</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            {groups.map(([id, g]) => (
              <tbody key={id} className="border-b border-line">
                <tr className="cursor-pointer bg-brand-50/50 hover:bg-brand-50" onClick={() => setClosed((c) => ({ ...c, [id]: !c[id] }))}>
                  <td colSpan={6} className="px-3 py-2 font-semibold">
                    <span className="inline-flex items-center gap-1.5"><ChevronDown className={cn('h-4 w-4 transition-transform', closed[id] && '-rotate-90')} aria-hidden />{g.name}<span className="text-xs font-normal text-muted">· {g.rows.length} {g.rows.length === 1 ? 'linha' : 'linhas'}</span></span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular">{formatBRL(g.planned)}</td>
                  <td className={cn('px-3 py-2 text-right font-semibold tabular', g.realized > g.planned && 'text-danger')}>{formatBRL(g.realized)}</td>
                  <td colSpan={2} className="px-3 py-2"><Progress planned={g.planned} realized={g.realized} /></td>
                </tr>
                {!closed[id] && g.rows.map((l) => {
                  const planned = n(l.total_amount), realized = n(l.realized_amount)
                  return (
                    <tr key={l.id} className={cn('border-t border-line/60 hover:bg-black/[0.02]', l.status === 'cancelado' && 'text-muted line-through')}>
                      <td className="max-w-[280px] px-3 py-1.5">
                        <button type="button" onClick={() => canEdit && onEdit(l)} className="block max-w-full truncate text-left font-medium hover:underline">{l.description}</button>
                        <span className="text-xs text-muted">{[l.subcategory, l.expense_type !== 'custeio' && l.expense_type !== 'receita' ? l.expense_type : null, l.is_extraordinary ? 'extraordinária' : null, l.recurrence !== 'nenhuma' ? l.recurrence : null].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted">{names.season(l.season_id)}{l.field_id ? <><br />{names.field(l.field_id)}</> : null}</td>
                      <td className="px-3 py-1.5 tabular">{formatDate(l.planned_date)}</td>
                      <td className="px-1 py-1 text-right"><CellInput label={`Quantidade de ${l.description}`} value={n(l.quantity)} disabled={!canEdit} onCommit={(v) => v > 0 && patch.mutate({ id: l.id, quantity: v })} /></td>
                      <td className="px-2 py-1.5 text-xs text-muted">{l.unit ?? ''}</td>
                      <td className="px-1 py-1 text-right"><CellInput label={`Valor unitário de ${l.description}`} value={n(l.unit_price)} disabled={!canEdit} onCommit={(v) => patch.mutate({ id: l.id, unit_price: v })} /></td>
                      <td className="px-3 py-1.5 text-right font-medium tabular">{formatBRL(patch.isPending && patch.variables?.id === l.id ? lineTotal(n(patch.variables.quantity ?? l.quantity), n(patch.variables.unit_price ?? l.unit_price)) : planned)}</td>
                      <td className={cn('px-3 py-1.5 text-right tabular', realized > planned && 'text-danger', realized === 0 && 'text-muted')}>{realized ? formatBRL(realized) : '—'}</td>
                      <td className="px-3 py-1.5"><Badge tone={STATUS[l.status as keyof typeof STATUS]?.tone ?? 'neutral'}>{STATUS[l.status as keyof typeof STATUS]?.label ?? l.status}</Badge></td>
                      <td className="px-1 py-1">{menu(l).length > 0 && <Dropdown trigger={<Button variant="ghost" size="icon" aria-label={`Ações de ${l.description}`}><MoreVertical className="h-4 w-4" /></Button>} items={menu(l)} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
            <tfoot>
              <tr className="bg-surface font-semibold">
                <td colSpan={6} className="px-3 py-2.5">Total {kind === 'despesa' ? 'de despesas' : 'de receitas'}</td>
                <td className="px-3 py-2.5 text-right tabular">{formatBRL(totPlanned)}</td>
                <td className="px-3 py-2.5 text-right tabular">{formatBRL(totRealized)}</td>
                <td colSpan={2} className="px-3 py-2.5 text-xs font-normal text-muted">{totPlanned > 0 ? `${formatNumber((totRealized / totPlanned) * 100, 0)}% executado` : ''}</td>
              </tr>
            </tfoot>
          </table>
          {canEdit && <p className="px-3 py-2 text-xs text-muted">Dica: clique em quantidade ou valor unitário para editar como numa planilha (Enter salva, Esc desfaz).</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([id, g]) => (
            <section key={id} className="card overflow-hidden">
              <button type="button" onClick={() => setClosed((c) => ({ ...c, [id]: !c[id] }))} aria-expanded={!closed[id]}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left [-webkit-tap-highlight-color:transparent]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{g.name}</span>
                    <span className="shrink-0 font-semibold tabular">{formatBRL(g.planned)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <span className="shrink-0">{g.rows.length} {g.rows.length === 1 ? 'linha' : 'linhas'}</span>
                    <Progress planned={g.planned} realized={g.realized} />
                    <span className={cn('shrink-0 tabular', g.realized > g.planned && 'text-danger')}>{formatBRL(g.realized)}</span>
                  </div>
                </div>
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform', closed[id] && '-rotate-90')} aria-hidden />
              </button>
              {!closed[id] && (
                <ul className="divide-y divide-line border-t border-line">
                  {g.rows.map((l) => (
                    <li key={l.id} className="flex items-stretch">
                      <button type="button" onClick={() => canEdit && onEdit(l)} className={cn('min-w-0 flex-1 px-4 py-3 text-left active:bg-black/[0.03]', l.status === 'cancelado' && 'opacity-60')}>
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-[15px] font-medium leading-snug">{l.description}</span>
                          <span className="shrink-0 text-[15px] font-semibold tabular">{formatBRL(l.total_amount)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <span className="tabular">{formatNumber(l.quantity, 4)} {l.unit ?? ''} × {formatBRL(l.unit_price)}</span>
                          <span>· {formatDate(l.planned_date)}</span>
                          <Badge tone={STATUS[l.status as keyof typeof STATUS]?.tone ?? 'neutral'}>{STATUS[l.status as keyof typeof STATUS]?.label ?? l.status}</Badge>
                          {n(l.realized_amount) > 0 && <span className={cn(n(l.realized_amount) > n(l.total_amount) && 'text-danger')}>Realizado {formatBRL(l.realized_amount)}</span>}
                        </div>
                      </button>
                      {menu(l).length > 0 && <div className="flex items-center pr-1"><Dropdown trigger={<Button variant="ghost" size="icon" aria-label={`Ações de ${l.description}`}><MoreVertical className="h-5 w-5" /></Button>} items={menu(l)} /></div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <div className="card flex items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>Total</span><span className="tabular">{formatBRL(totPlanned)} <span className="font-normal text-muted">· realizado {formatBRL(totRealized)}</span></span>
          </div>
        </div>
      )}
      {node}
    </div>
  )
}
