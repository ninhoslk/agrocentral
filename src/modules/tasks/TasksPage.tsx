import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Columns3, List, ListChecks, Plus } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useAuth } from '@/app/providers/AuthProvider'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Checkbox, Select } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState, LoadingRows } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatDate, toISODate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Tables } from '@/types/database'

export const TASK_STATUS = [
  { value: 'planejada', label: 'Planejada', tone: 'blue' }, { value: 'pendente', label: 'Pendente', tone: 'yellow' },
  { value: 'em_andamento', label: 'Em andamento', tone: 'blue' }, { value: 'concluida', label: 'Concluída', tone: 'green' },
  { value: 'cancelada', label: 'Cancelada', tone: 'neutral' },
] as const
const PRIORITY = [
  { value: 'baixa', label: 'Baixa', tone: 'neutral' }, { value: 'media', label: 'Média', tone: 'blue' },
  { value: 'alta', label: 'Alta', tone: 'yellow' }, { value: 'urgente', label: 'Urgente', tone: 'red' },
] as const

type Task = Tables<'tasks'> & { fields: { name: string } | null; seasons: { name: string } | null; employees: { full_name: string } | null; farms: { name: string } | null }

export function TasksPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const { user } = useAuth()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [edit, setEdit] = useState<Partial<Task> | null>(null)
  const [mine, setMine] = useState(false)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => { if (params.get('novo')) setEdit({}) }, [params])

  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => unwrap(supabase.rpc('list_members', { p_org: orgId })) })
  const q = useQuery({
    queryKey: ['tasks', orgId, farmId],
    queryFn: () => {
      let qb = supabase.from('tasks').select('*, fields(name), seasons(name), employees(full_name), farms(name)').eq('organization_id', orgId).is('archived_at', null).order('due_date', { ascending: true, nullsFirst: false })
      if (farmId) qb = qb.eq('farm_id', farmId)
      return unwrap(qb) as unknown as Promise<Task[]>
    },
  })
  const inval = [['tasks'], ['dashboard']]
  const save = useAppMutation(async (v: Record<string, unknown>) => {
    if (edit?.id) return unwrap(supabase.from('tasks').update(v as never).eq('id', edit.id))
    return unwrap(supabase.from('tasks').insert({ ...v, organization_id: orgId } as never))
  }, { invalidate: inval })
  const setStatus = useAppMutation(async ({ id, status }: { id: string; status: string }) => unwrap(supabase.from('tasks').update({ status }).eq('id', id)), { invalidate: inval })

  const today = toISODate()
  const rows = useMemo(() => (q.data ?? []).filter((t) => (!mine || t.assignee_user_id === user?.id) && (showDone || !['concluida', 'cancelada'].includes(t.status))), [q.data, mine, showDone, user?.id])

  const fieldsDef = (farm?: string | null): FieldDef[] => [
    { name: 'title', label: 'Título', type: 'text', required: true, maxLength: 160, span: 3 },
    { name: 'description', label: 'Descrição', type: 'textarea', maxLength: 2000, span: 3 },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), span: 2 },
    { name: 'field_id', label: 'Talhão', type: 'select', options: toOptions((lk.fields.data ?? []).filter((f) => !farm || f.farm_id === farm), (f) => f.name), span: 2 },
    { name: 'season_id', label: 'Safra', type: 'select', options: toOptions((lk.seasons.data ?? []).filter((s) => !farm || s.farm_id === farm), (s) => s.name), span: 2 },
    { name: 'due_date', label: 'Prazo', type: 'date', span: 2 },
    { name: 'priority', label: 'Prioridade', type: 'select', required: true, options: PRIORITY.map(({ value, label }) => ({ value, label })), span: 2 },
    { name: 'status', label: 'Status', type: 'select', required: true, options: TASK_STATUS.map(({ value, label }) => ({ value, label })), span: 2 },
    { name: 'assignee_employee_id', label: 'Responsável (colaborador)', type: 'select', options: toOptions(lk.employees.data, (e) => e.full_name), span: 3 },
    { name: 'assignee_user_id', label: 'Usuário notificado', type: 'select', options: (members.data ?? []).map((m) => ({ value: m.user_id, label: m.full_name ?? m.email ?? 'Usuário' })), span: 3, hint: 'Recebe notificação da atribuição e de atraso' },
  ]

  const cols: Column<Task>[] = [
    { key: 'title', header: 'Tarefa', primary: true, sortable: true, value: (r) => r.title, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.title}<DemoBadge show={r.is_demo} /></span> },
    { key: 'due', header: 'Prazo', sortable: true, value: (r) => r.due_date, cell: (r) => <span className={cn(r.due_date && r.due_date < today && !['concluida', 'cancelada'].includes(r.status) && 'font-medium text-danger')}>{formatDate(r.due_date)}</span> },
    { key: 'prio', header: 'Prioridade', value: (r) => r.priority, cell: (r) => { const p = PRIORITY.find((x) => x.value === r.priority)!; return <Badge tone={p.tone}>{p.label}</Badge> } },
    { key: 'status', header: 'Status', value: (r) => r.status, cell: (r) => { const s = TASK_STATUS.find((x) => x.value === r.status)!; return <Badge tone={s.tone}>{s.label}</Badge> } },
    { key: 'where', header: 'Local', value: (r) => r.fields?.name ?? r.farms?.name, cell: (r) => r.fields?.name ?? r.farms?.name ?? '—' },
    { key: 'who', header: 'Responsável', value: (r) => r.employees?.full_name, cell: (r) => r.employees?.full_name ?? '—' },
  ]

  const canEdit = can('tasks', 'edit')
  return (
    <>
      <PageHeader title="Tarefas" crumbs={[{ label: 'Minha fazenda' }, { label: 'Tarefas' }]} description="Planeje e acompanhe tarefas com prazo, prioridade e responsável."
        actions={<>
          <Button variant="outline" size="icon" aria-label="Alternar visualização" onClick={() => setView(view === 'board' ? 'list' : 'board')}>{view === 'board' ? <List className="h-4 w-4" /> : <Columns3 className="h-4 w-4" />}</Button>
          {can('tasks', 'create') && <Button onClick={() => setEdit({})}><Plus className="h-4 w-4" />Nova tarefa</Button>}
        </>} />
      <div className="mb-4 flex flex-wrap gap-4">
        <Checkbox label="Somente atribuídas a mim" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        <Checkbox label="Mostrar concluídas/canceladas" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
      </div>
      {view === 'list' ? (
        <DataTable rows={rows} columns={cols} loading={q.isLoading} error={q.error} onRowClick={(r) => setEdit(r)} exportName="Tarefas" />
      ) : q.isLoading ? <LoadingRows /> : !rows.length ? (
        <div className="card"><EmptyState icon={<ListChecks className="h-6 w-6" />} title="Nenhuma tarefa" description="Crie tarefas e atribua responsáveis." /></div>
      ) : (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUS.filter((s) => showDone || !['concluida', 'cancelada'].includes(s.value)).map((s) => {
            const items = rows.filter((t) => t.status === s.value)
            return (
              <section key={s.value} className="rounded-xl bg-black/[0.03] p-2" aria-label={s.label}>
                <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">{s.label}<span className="text-xs font-normal text-muted">{items.length}</span></h2>
                <ul className="space-y-2">
                  {items.map((t) => {
                    const late = t.due_date && t.due_date < today
                    const p = PRIORITY.find((x) => x.value === t.priority)!
                    return (
                      <li key={t.id} className="card p-3">
                        <button type="button" className="block w-full text-left" onClick={() => setEdit(t)}>
                          <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{t.title}</span><Badge tone={p.tone}>{p.label}</Badge></div>
                          <div className="mt-1 text-xs text-muted">{t.fields?.name ?? t.farms?.name ?? 'Geral'}{t.employees && ` · ${t.employees.full_name}`}</div>
                          {t.due_date && <div className={cn('mt-1 text-xs', late ? 'font-medium text-danger' : 'text-muted')}>{late ? 'Atrasada · ' : 'Prazo · '}{formatDate(t.due_date)}</div>}
                        </button>
                        {(canEdit || t.assignee_user_id === user?.id) && (
                          <Select aria-label="Mover para" value={t.status} className="mt-2 h-10 text-sm sm:h-8 sm:text-xs" onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value })}>
                            {TASK_STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                          </Select>
                        )}
                        <DemoBadge show={t.is_demo} />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      <TaskDialog edit={edit} onClose={() => { setEdit(null); if (params.get('novo')) { params.delete('novo'); setParams(params, { replace: true }) } }} fieldsDef={fieldsDef}
        onSubmit={(v) => save.mutateAsync(v)} readOnly={!!edit?.id && !canEdit} />
    </>
  )
}

function TaskDialog({ edit, onClose, fieldsDef, onSubmit, readOnly }: { edit: Partial<Task> | null; onClose: () => void; fieldsDef: (farm?: string | null) => FieldDef[]; onSubmit: (v: Record<string, unknown>) => Promise<unknown>; readOnly: boolean }) {
  const { farmId } = useCurrentOrg()
  const farm = edit?.farm_id ?? farmId
  const fields = fieldsDef(farm).map((f) => (readOnly ? { ...f, disabled: true } : f))
  return (
    <ResourceFormDialog open={!!edit} onOpenChange={(o) => !o && onClose()} title={edit?.id ? 'Editar tarefa' : 'Nova tarefa'} fields={fields}
      initial={edit} defaults={{ status: 'pendente', priority: 'media', farm_id: farmId }} onSubmit={onSubmit} submitLabel={readOnly ? 'Fechar' : 'Salvar'} />
  )
}
