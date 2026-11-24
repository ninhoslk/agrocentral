import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Checkbox, Tabs } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatBRL, formatDate, formatNumber, toISODate } from '@/lib/format'
import type { Tables } from '@/types/database'

type Emp = Tables<'employees'> & { farms: { name: string } | null }
type Team = Tables<'teams'> & { farms: { name: string } | null; employees: { full_name: string } | null; team_members: { employee_id: string }[] }
type Log = Tables<'work_logs'> & { employees: { full_name: string; hourly_cost: number | null } | null; activities: { title: string | null } | null }

const STATUS = { ativo: { label: 'Ativo', tone: 'green' }, inactive: { label: 'Inativo', tone: 'neutral' }, inativo: { label: 'Inativo', tone: 'neutral' }, afastado: { label: 'Afastado', tone: 'yellow' } } as const

export function TeamPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const lk = useLookups()
  const [tab, setTab] = useState<'colaboradores' | 'equipes' | 'horas'>('colaboradores')
  const [emp, setEmp] = useState<Partial<Emp> | null>(null)
  const [team, setTeam] = useState<Partial<Team> | null>(null)
  const [members, setMembers] = useState<Team | null>(null)
  const [logOpen, setLogOpen] = useState(false)

  const emps = useQuery({ queryKey: ['employees', orgId, farmId], queryFn: () => { let q = supabase.from('employees').select('*, farms(name)').eq('organization_id', orgId).is('archived_at', null).order('full_name'); if (farmId) q = q.or(`farm_id.eq.${farmId},farm_id.is.null`); return unwrap(q) as unknown as Promise<Emp[]> } })
  const teams = useQuery({ queryKey: ['teams', orgId], queryFn: () => unwrap(supabase.from('teams').select('*, farms(name), employees(full_name), team_members(employee_id)').eq('organization_id', orgId).order('name')) as unknown as Promise<Team[]> })
  const logs = useQuery({ queryKey: ['work-logs', orgId], enabled: tab === 'horas', queryFn: () => unwrap(supabase.from('work_logs').select('*, employees(full_name, hourly_cost), activities(title)').eq('organization_id', orgId).order('work_date', { ascending: false }).limit(500)) as unknown as Promise<Log[]> })

  const inval = [['employees'], ['lk-employees'], ['teams'], ['lk-teams'], ['work-logs']]
  const saveEmp = useAppMutation(async (v: Record<string, unknown>) => emp?.id ? unwrap(supabase.from('employees').update(v as never).eq('id', emp.id)) : unwrap(supabase.from('employees').insert({ ...v, organization_id: orgId } as never)), { invalidate: inval })
  const archiveEmp = useAppMutation(async (id: string) => unwrap(supabase.from('employees').update({ archived_at: new Date().toISOString(), status: 'inativo' }).eq('id', id)), { invalidate: inval, success: 'Colaborador arquivado' })
  const saveTeam = useAppMutation(async (v: Record<string, unknown>) => team?.id ? unwrap(supabase.from('teams').update(v as never).eq('id', team.id)) : unwrap(supabase.from('teams').insert({ ...v, organization_id: orgId } as never)), { invalidate: inval })
  const toggleMember = useAppMutation(async ({ teamId, employeeId, on }: { teamId: string; employeeId: string; on: boolean }) =>
    on ? unwrap(supabase.from('team_members').insert({ organization_id: orgId, team_id: teamId, employee_id: employeeId }))
      : unwrap(supabase.from('team_members').delete().eq('team_id', teamId).eq('employee_id', employeeId)), { invalidate: [['teams']] })
  const addLog = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('work_logs').insert({ ...v, organization_id: orgId } as never)), { invalidate: [['work-logs']] })

  const empFields: FieldDef[] = [
    { name: 'full_name', label: 'Nome completo', type: 'text', required: true, maxLength: 120, span: 2 },
    { name: 'role_title', label: 'Função / cargo', type: 'text', maxLength: 80, span: 1 },
    { name: 'phone', label: 'Telefone', type: 'tel', maxLength: 30, span: 1 },
    { name: 'email', label: 'E-mail', type: 'email', span: 2 },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), emptyOption: 'Todas', span: 2 },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'ativo', label: 'Ativo' }, { value: 'afastado', label: 'Afastado' }, { value: 'inativo', label: 'Inativo' }], span: 1 },
    { name: 'hire_date', label: 'Admissão', type: 'date', span: 1 },
    { name: 'hourly_cost', label: 'Custo/hora', type: 'money', min: 0, span: 1, hint: 'Usado no custo das horas registradas' },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]
  const teamFields: FieldDef[] = [
    { name: 'name', label: 'Nome da equipe', type: 'text', required: true, maxLength: 80, span: 2 },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), span: 1 },
    { name: 'leader_employee_id', label: 'Líder', type: 'select', options: toOptions(lk.employees.data, (e) => e.full_name), span: 3 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]
  const logFields: FieldDef[] = [
    { name: 'employee_id', label: 'Colaborador', type: 'select', required: true, options: toOptions(lk.employees.data, (e) => e.full_name), span: 2 },
    { name: 'work_date', label: 'Data', type: 'date', required: true, span: 1 },
    { name: 'hours', label: 'Horas', type: 'number', required: true, min: 0.25, max: 24, span: 1 },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), span: 2 },
    { name: 'notes', label: 'Atividade / observação', type: 'textarea', maxLength: 1000, span: 3 },
  ]

  const empCols: Column<Emp>[] = [
    { key: 'name', header: 'Nome', primary: true, sortable: true, value: (r) => r.full_name, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.full_name}<DemoBadge show={r.is_demo} /></span> },
    { key: 'role', header: 'Função', value: (r) => r.role_title, cell: (r) => r.role_title ?? '—' },
    { key: 'farm', header: 'Propriedade', value: (r) => r.farms?.name, cell: (r) => r.farms?.name ?? 'Todas' },
    { key: 'phone', header: 'Contato', value: (r) => r.phone, cell: (r) => r.phone ?? r.email ?? '—' },
    { key: 'status', header: 'Situação', value: (r) => r.status, cell: (r) => { const s = STATUS[r.status as keyof typeof STATUS]; return <Badge tone={s?.tone}>{s?.label}</Badge> } },
    { key: 'cost', header: 'Custo/h', align: 'right', value: (r) => Number(r.hourly_cost ?? 0), cell: (r) => formatBRL(r.hourly_cost) },
  ]
  const teamCols: Column<Team>[] = [
    { key: 'name', header: 'Equipe', primary: true, value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'leader', header: 'Líder', value: (r) => r.employees?.full_name, cell: (r) => r.employees?.full_name ?? '—' },
    { key: 'farm', header: 'Propriedade', value: (r) => r.farms?.name, cell: (r) => r.farms?.name ?? '—' },
    { key: 'members', header: 'Membros', align: 'right', value: (r) => r.team_members.length, cell: (r) => r.team_members.length },
    { key: 'act', header: '', align: 'right', cell: (r) => can('team', 'edit') ? <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setMembers(r) }}>Membros</Button> : null },
  ]
  const logCols: Column<Log>[] = [
    { key: 'date', header: 'Data', sortable: true, value: (r) => r.work_date, cell: (r) => formatDate(r.work_date) },
    { key: 'emp', header: 'Colaborador', primary: true, value: (r) => r.employees?.full_name, cell: (r) => r.employees?.full_name },
    { key: 'hours', header: 'Horas', align: 'right', value: (r) => Number(r.hours), cell: (r) => formatNumber(r.hours, 2) },
    { key: 'cost', header: 'Custo estimado', align: 'right', value: (r) => Number(r.hours) * Number(r.employees?.hourly_cost ?? 0), cell: (r) => (r.employees?.hourly_cost ? formatBRL(Number(r.hours) * Number(r.employees.hourly_cost)) : '—') },
    { key: 'what', header: 'Atividade', value: (r) => r.activities?.title ?? r.notes, cell: (r) => r.activities?.title ?? r.notes ?? '—' },
  ]

  const currentTeam = teams.data?.find((t) => t.id === members?.id)
  return (
    <>
      <PageHeader title="Equipe" crumbs={[{ label: 'Minha fazenda' }, { label: 'Equipe' }]} description="Colaboradores, equipes e registro de horas. Para dar acesso ao sistema, convide o usuário em Configurações → Usuários."
        actions={can('team', 'create') && <>
          {tab === 'colaboradores' && <Button onClick={() => setEmp({})}><Plus className="h-4 w-4" />Novo colaborador</Button>}
          {tab === 'equipes' && <Button onClick={() => setTeam({})}><Plus className="h-4 w-4" />Nova equipe</Button>}
          {tab === 'horas' && <Button onClick={() => setLogOpen(true)}><Plus className="h-4 w-4" />Registrar horas</Button>}
        </>} />
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'colaboradores', label: 'Colaboradores', count: emps.data?.length }, { value: 'equipes', label: 'Equipes', count: teams.data?.length }, { value: 'horas', label: 'Horas trabalhadas' }]} />
      {tab === 'colaboradores' && <DataTable rows={emps.data} columns={empCols} loading={emps.isLoading} error={emps.error} onRowClick={(r) => can('team', 'edit') && setEmp(r)} exportName="Colaboradores"
        empty={<EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum colaborador" description="Cadastre colaboradores para atribuir tarefas e registrar atividades." />} />}
      {tab === 'equipes' && <DataTable rows={teams.data} columns={teamCols} loading={teams.isLoading} error={teams.error} onRowClick={(r) => can('team', 'edit') && setTeam(r)} exportName="Equipes" />}
      {tab === 'horas' && <DataTable rows={logs.data} columns={logCols} loading={logs.isLoading} error={logs.error} exportName="Horas trabalhadas" />}

      <ResourceFormDialog open={!!emp} onOpenChange={(o) => !o && setEmp(null)} title={emp?.id ? 'Editar colaborador' : 'Novo colaborador'} fields={empFields} initial={emp} defaults={{ status: 'ativo', farm_id: farmId }}
        onSubmit={(v) => saveEmp.mutateAsync(v)}
        extra={() => emp?.id && can('team', 'delete') ? <Button variant="outline" className="text-danger" onClick={() => { archiveEmp.mutate(emp.id!); setEmp(null) }}>Arquivar colaborador</Button> : null} />
      <ResourceFormDialog open={!!team} onOpenChange={(o) => !o && setTeam(null)} title={team?.id ? 'Editar equipe' : 'Nova equipe'} fields={teamFields} initial={team} defaults={{ farm_id: farmId }} onSubmit={(v) => saveTeam.mutateAsync(v)} />
      <ResourceFormDialog open={logOpen} onOpenChange={setLogOpen} title="Registrar horas" fields={logFields} defaults={{ work_date: toISODate(), farm_id: farmId }} onSubmit={(v) => addLog.mutateAsync(v)} />
      <Dialog open={!!members} onOpenChange={(o) => !o && setMembers(null)} title={`Membros — ${members?.name ?? ''}`} size="sm">
        <ul className="space-y-2">
          {(lk.employees.data ?? []).map((e) => (
            <li key={e.id}>
              <Checkbox label={e.full_name} checked={!!currentTeam?.team_members.some((m) => m.employee_id === e.id)}
                onChange={(ev) => toggleMember.mutate({ teamId: members!.id, employeeId: e.id, on: ev.target.checked })} />
            </li>
          ))}
          {!lk.employees.data?.length && <li className="text-sm text-muted">Cadastre colaboradores primeiro.</li>}
        </ul>
      </Dialog>
    </>
  )
}
