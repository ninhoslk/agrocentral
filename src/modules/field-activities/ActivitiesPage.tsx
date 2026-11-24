import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, List, Plus, Rows3 } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader, KeyValue } from '@/components/ui/layout'
import { FilterPanel } from '@/components/ui/FilterPanel'
import { Badge, Button, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { Dialog, useConfirm } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState, ErrorState, LoadingRows } from '@/components/feedback/states'
import { useLookups } from '@/hooks/useLookups'
import { addDays, formatBRL, formatDate, formatDateTime, formatNumber, toISODate } from '@/lib/format'
import { ActivityFormDialog, ACTIVITY_STATUS } from './ActivityFormDialog'

const STATUS_TONE = { planejada: 'blue', em_andamento: 'yellow', concluida: 'green', cancelada: 'red' } as const

interface ActivityRow {
  id: string; title: string | null; status: string; started_at: string; ended_at: string | null; notes: string | null; is_demo: boolean
  labor_cost: number; other_cost: number; inputs_cost: number; area_worked_ha: number | null; farm_id: string; field_id: string | null; season_id: string | null
  activity_types: { name: string; color: string | null } | null; fields: { name: string } | null; seasons: { name: string } | null; farms: { name: string } | null
  employees: { full_name: string } | null; equipment: { name: string } | null
}

export function ActivitiesPage() {
  const { orgId, farmId, can } = useCurrentOrg()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'timeline' | 'table'>('timeline')
  const [detail, setDetail] = useState<ActivityRow | null>(null)
  const [filters, setFilters] = useState({ from: toISODate(addDays(new Date(), -90)), to: toISODate(addDays(new Date(), 30)), field: params.get('talhao') ?? '', season: params.get('safra') ?? '', type: '', employee: '' })

  useEffect(() => {
    if (params.get('novo') || params.get('talhao') || params.get('safra')) {
      if (params.get('novo')) setOpen(true)
    }
  }, [params])

  const q = useQuery({
    queryKey: ['activities', orgId, farmId, filters],
    queryFn: () => {
      let qb = supabase.from('activities')
        .select('*, activity_types(name, color), fields(name), seasons(name), farms(name), employees(full_name), equipment(name)')
        .eq('organization_id', orgId).is('archived_at', null)
        .gte('started_at', `${filters.from}T00:00:00`).lte('started_at', `${filters.to}T23:59:59`)
        .order('started_at', { ascending: false }).limit(500)
      if (farmId) qb = qb.eq('farm_id', farmId)
      if (filters.field) qb = qb.eq('field_id', filters.field)
      if (filters.season) qb = qb.eq('season_id', filters.season)
      if (filters.type) qb = qb.eq('activity_type_id', filters.type)
      if (filters.employee) qb = qb.eq('responsible_employee_id', filters.employee)
      return unwrap(qb) as unknown as Promise<ActivityRow[]>
    },
  })

  const grouped = useMemo(() => {
    const m = new Map<string, ActivityRow[]>()
    for (const a of q.data ?? []) {
      const d = toISODate(new Date(a.started_at))
      m.set(d, [...(m.get(d) ?? []), a])
    }
    return [...m.entries()]
  }, [q.data])

  const total = (a: ActivityRow) => Number(a.labor_cost) + Number(a.other_cost) + Number(a.inputs_cost)
  const cols: Column<ActivityRow>[] = [
    { key: 'date', header: 'Data', sortable: true, value: (r) => r.started_at, cell: (r) => formatDateTime(r.started_at) },
    { key: 'type', header: 'Atividade', primary: true, value: (r) => `${r.activity_types?.name} ${r.title ?? ''}`, cell: (r) => <span className="font-medium">{r.activity_types?.name}{r.title && <span className="font-normal text-muted"> — {r.title}</span>}</span> },
    { key: 'field', header: 'Talhão', value: (r) => r.fields?.name, cell: (r) => r.fields?.name ?? 'Propriedade' },
    { key: 'season', header: 'Safra', value: (r) => r.seasons?.name, cell: (r) => r.seasons?.name ?? '—' },
    { key: 'resp', header: 'Responsável', value: (r) => r.employees?.full_name, cell: (r) => r.employees?.full_name ?? '—' },
    { key: 'status', header: 'Situação', value: (r) => r.status, cell: (r) => <Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE]}>{ACTIVITY_STATUS.find((s) => s.value === r.status)?.label}</Badge> },
    { key: 'cost', header: 'Custo', align: 'right', sortable: true, value: (r) => total(r), cell: (r) => formatBRL(total(r)) },
  ]
  const farmFields = (lk.fields.data ?? []).filter((f) => !farmId || f.farm_id === farmId)
  const farmSeasons = (lk.seasons.data ?? []).filter((s) => !farmId || s.farm_id === farmId)

  return (
    <>
      <PageHeader title="Diário de campo" crumbs={[{ label: 'Minha fazenda' }, { label: 'Diário de campo' }]}
        description="Registro do que acontece na propriedade: operações, insumos, máquinas, equipe e custos."
        actions={<>
          <Button variant="outline" size="icon" aria-label={view === 'timeline' ? 'Ver tabela' : 'Ver linha do tempo'} onClick={() => setView(view === 'timeline' ? 'table' : 'timeline')}>{view === 'timeline' ? <List className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}</Button>
          {can('activities', 'create') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Registrar atividade</Button>}
        </>} />

      <FilterPanel gridClassName="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" summary={[`${formatDate(filters.from)} a ${formatDate(filters.to)}`, filters.field && lk.fields.data?.find((f) => f.id === filters.field)?.name, filters.season && lk.seasons.data?.find((s) => s.id === filters.season)?.name].filter(Boolean).join(' · ')}>
        <FieldWrap label="De" htmlFor="f-from"><Input id="f-from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></FieldWrap>
        <FieldWrap label="Até" htmlFor="f-to"><Input id="f-to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></FieldWrap>
        <FieldWrap label="Talhão" htmlFor="f-field"><Select id="f-field" value={filters.field} onChange={(e) => setFilters({ ...filters, field: e.target.value })}><option value="">Todos</option>{farmFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></FieldWrap>
        <FieldWrap label="Safra" htmlFor="f-season"><Select id="f-season" value={filters.season} onChange={(e) => setFilters({ ...filters, season: e.target.value })}><option value="">Todas</option>{farmSeasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FieldWrap>
        <FieldWrap label="Tipo" htmlFor="f-type"><Select id="f-type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Todos</option>{lk.activityTypes.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></FieldWrap>
        <FieldWrap label="Colaborador" htmlFor="f-emp"><Select id="f-emp" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}><option value="">Todos</option>{lk.employees.data?.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select></FieldWrap>
      </FilterPanel>

      {view === 'table' ? (
        <DataTable rows={q.data} columns={cols} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} onRowClick={setDetail} exportName="Diário de campo" initialSort={{ key: 'date', dir: 'desc' }} />
      ) : q.isLoading ? <LoadingRows /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !grouped.length ? (
        <div className="card"><EmptyState icon={<BookOpen className="h-6 w-6" />} title="Nenhuma atividade no período" description="Ajuste os filtros ou registre a primeira atividade."
          action={can('activities', 'create') ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Registrar atividade</Button> : undefined} /></div>
      ) : (
        <ol className="relative space-y-6 border-l-2 border-brand-100 pl-6">
          {grouped.map(([day, items]) => (
            <li key={day}>
              <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" aria-hidden />
              <h3 className="mb-2 text-sm font-semibold">{formatDate(day)}</h3>
              <ul className="space-y-2">
                {items.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setDetail(a)} className="card flex w-full flex-wrap items-start gap-3 p-3 text-left hover:border-brand-300">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.activity_types?.color ?? '#757575' }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{a.activity_types?.name}{a.title && <span className="font-normal text-muted">— {a.title}</span>}<DemoBadge show={a.is_demo} /></span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {new Date(a.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {a.fields?.name ?? 'Propriedade toda'}{!farmId && ` (${a.farms?.name})`}{a.seasons && ` · ${a.seasons.name}`}{a.employees && ` · ${a.employees.full_name}`}{a.equipment && ` · ${a.equipment.name}`}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Badge tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE]}>{ACTIVITY_STATUS.find((s) => s.value === a.status)?.label}</Badge>
                        {total(a) > 0 && <span className="text-xs tabular text-muted">{formatBRL(total(a))}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <ActivityFormDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && params.get('novo')) { params.delete('novo'); setParams(params, { replace: true }) } }}
        defaults={{ ...(filters.field ? { field_id: filters.field, farm_id: lk.fields.data?.find((f) => f.id === filters.field)?.farm_id } : {}), ...(filters.season ? { season_id: filters.season, farm_id: lk.seasons.data?.find((s) => s.id === filters.season)?.farm_id } : {}) }} />
      <ActivityDetail activity={detail} onClose={() => setDetail(null)} />
    </>
  )
}

function ActivityDetail({ activity, onClose }: { activity: ActivityRow | null; onClose: () => void }) {
  const { can } = useCurrentOrg()
  const { confirm, node } = useConfirm()
  const inputs = useQuery({
    queryKey: ['activity-inputs', activity?.id],
    enabled: !!activity,
    queryFn: () => unwrap(supabase.from('activity_inputs').select('id, quantity, dose_per_ha, unit_cost, total_cost, inventory_items(name, unit)').eq('activity_id', activity!.id)),
  })
  const inval = [['activities'], ['lk-items'], ['inventory'], ['dashboard'], ['activity-inputs']]
  const setStatus = useAppMutation(async (status: string) => unwrap(supabase.from('activities').update({ status }).eq('id', activity!.id)), { invalidate: inval, success: 'Situação atualizada', onSuccess: onClose })
  const remove = useAppMutation(async () => unwrap(supabase.from('activities').delete().eq('id', activity!.id)), { invalidate: inval, success: 'Atividade excluída e estoque estornado', onSuccess: onClose })
  const removeInput = useAppMutation(async (id: string) => unwrap(supabase.from('activity_inputs').delete().eq('id', id)), { invalidate: inval, success: 'Insumo removido e estoque estornado' })
  if (!activity) return null
  const a = activity
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`${a.activity_types?.name}${a.title ? ` — ${a.title}` : ''}`} size="lg"
      footer={<>
        {can('activities', 'delete') && <Button variant="outline" className="mr-auto text-danger" onClick={async () => {
          if (await confirm('Excluir atividade?', 'Os insumos lançados serão estornados ao estoque. Esta ação não pode ser desfeita.', 'Excluir')) remove.mutate()
        }}>Excluir</Button>}
        {can('activities', 'edit') && a.status !== 'concluida' && <Button variant="secondary" onClick={() => setStatus.mutate('concluida')}>Marcar como concluída</Button>}
        {can('activities', 'edit') && a.status === 'planejada' && <Button variant="outline" onClick={() => setStatus.mutate('cancelada')}>Cancelar atividade</Button>}
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </>}>
      <div className="space-y-5">
        <KeyValue items={[
          { label: 'Início', value: formatDateTime(a.started_at) }, { label: 'Término', value: formatDateTime(a.ended_at) },
          { label: 'Propriedade', value: a.farms?.name }, { label: 'Talhão', value: a.fields?.name ?? 'Toda a propriedade' },
          { label: 'Safra', value: a.seasons?.name }, { label: 'Responsável', value: a.employees?.full_name },
          { label: 'Máquina', value: a.equipment?.name }, { label: 'Área trabalhada', value: a.area_worked_ha ? `${formatNumber(a.area_worked_ha)} ha` : null },
          { label: 'Mão de obra', value: formatBRL(a.labor_cost) }, { label: 'Insumos', value: formatBRL(a.inputs_cost) }, { label: 'Outros', value: formatBRL(a.other_cost) },
          { label: 'Custo total', value: <strong>{formatBRL(Number(a.labor_cost) + Number(a.other_cost) + Number(a.inputs_cost))}</strong> },
        ]} />
        {a.notes && <p className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm">{a.notes}</p>}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Insumos utilizados</h3>
          {inputs.isLoading ? <LoadingRows rows={2} /> : !inputs.data?.length ? <p className="text-sm text-muted">Nenhum insumo lançado.</p> : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {inputs.data.map((i) => {
                const it = i.inventory_items as { name: string; unit: string } | null
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{it?.name} <span className="text-muted">· {formatNumber(i.quantity)} {it?.unit}{i.dose_per_ha ? ` (${formatNumber(i.dose_per_ha)} ${it?.unit}/ha)` : ''}</span></span>
                    <span className="flex items-center gap-2"><span className="tabular">{formatBRL(i.total_cost)}</span>
                      {can('activities', 'edit') && <Button variant="ghost" size="sm" onClick={async () => { if (await confirm('Remover insumo?', 'A quantidade volta para o estoque.', 'Remover')) removeInput.mutate(i.id) }}>Remover</Button>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      {node}
    </Dialog>
  )
}
