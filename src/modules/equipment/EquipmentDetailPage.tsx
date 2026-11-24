import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Fuel, Pencil, Wrench } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { KeyValue, PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Tabs } from '@/components/ui/primitives'
import { DataStateBadge, ErrorState, LoadingRows } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatBRL, formatDate, formatNumber, toISODate } from '@/lib/format'
import { EQUIP_KINDS, EQUIP_STATUS, equipmentFields, maintenanceState } from './config'
import type { Tables } from '@/types/database'

type Usage = Tables<'equipment_usage'> & { employees: { full_name: string } | null; fields: { name: string } | null; activities: { title: string | null } | null }
type Maint = Tables<'maintenance_records'>

export function EquipmentDetailPage() {
  const { id = '' } = useParams()
  const { orgId, farms, can } = useCurrentOrg()
  const lk = useLookups()
  const [tab, setTab] = useState<'uso' | 'manutencoes'>('manutencoes')
  const [edit, setEdit] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [maint, setMaint] = useState<Partial<Maint> | null>(null)

  const eq = useQuery({ queryKey: ['equipment', 'one', id], queryFn: () => unwrap(supabase.from('equipment').select('*, farms(name)').eq('id', id).single()) })
  const usage = useQuery({ queryKey: ['equipment', 'usage', id], queryFn: () => unwrap(supabase.from('equipment_usage').select('*, employees(full_name), fields(name), activities(title)').eq('equipment_id', id).order('usage_date', { ascending: false })) as unknown as Promise<Usage[]> })
  const maints = useQuery({ queryKey: ['equipment', 'maint', id], queryFn: () => unwrap(supabase.from('maintenance_records').select('*').eq('equipment_id', id).order('performed_date', { ascending: false, nullsFirst: true })) })

  const inval = [['equipment'], ['lk-equipment'], ['dashboard']]
  const update = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('equipment').update(v as never).eq('id', id)), { invalidate: inval })
  const addUsage = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('equipment_usage').insert({ ...v, organization_id: orgId, equipment_id: id } as never)), { invalidate: inval })
  const saveMaint = useAppMutation(async (v: Record<string, unknown>) => maint?.id ? unwrap(supabase.from('maintenance_records').update(v as never).eq('id', maint.id)) : unwrap(supabase.from('maintenance_records').insert({ ...v, organization_id: orgId, equipment_id: id } as never)), { invalidate: inval })

  if (eq.isLoading) return <LoadingRows rows={8} />
  if (eq.error || !eq.data) return <ErrorState error={eq.error} onRetry={() => eq.refetch()} />
  const e = eq.data
  const m = maintenanceState(e)
  const u = usage.data ?? []
  const totalHours = u.reduce((s, x) => s + Number(x.hours ?? 0), 0)
  const totalFuel = u.reduce((s, x) => s + Number(x.fuel_liters ?? 0), 0)
  const fuelCost = u.reduce((s, x) => s + Number(x.fuel_cost ?? 0), 0)
  const maintCost = (maints.data ?? []).filter((x) => x.status === 'concluida').reduce((s, x) => s + Number(x.total_cost), 0)
  const st = EQUIP_STATUS[e.status as keyof typeof EQUIP_STATUS]

  const usageFields: FieldDef[] = [
    { name: 'usage_date', label: 'Data', type: 'date', required: true, span: 1 },
    { name: 'hours', label: 'Horas trabalhadas', type: 'number', min: 0, max: 24, span: 1 },
    { name: 'hour_meter_end', label: 'Horímetro final', type: 'number', min: 0, suffix: 'h', span: 1, hint: `Atual: ${formatNumber(e.hour_meter, 1)} h` },
    { name: 'km', label: 'Km rodados', type: 'number', min: 0, span: 1 },
    { name: 'fuel_liters', label: 'Combustível', type: 'number', min: 0, suffix: 'L', span: 1 },
    { name: 'fuel_cost', label: 'Custo do combustível', type: 'money', min: 0, span: 1 },
    { name: 'operator_employee_id', label: 'Operador', type: 'select', options: toOptions(lk.employees.data, (x) => x.full_name), span: 2 },
    { name: 'field_id', label: 'Talhão', type: 'select', options: toOptions(lk.fields.data, (x) => x.name), span: 1 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]
  const maintFields: FieldDef[] = [
    { name: 'kind', label: 'Tipo', type: 'select', required: true, options: [{ value: 'preventiva', label: 'Preventiva' }, { value: 'corretiva', label: 'Corretiva' }], span: 1 },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'agendada', label: 'Agendada' }, { value: 'concluida', label: 'Concluída' }, { value: 'cancelada', label: 'Cancelada' }], span: 1 },
    { name: 'scheduled_date', label: 'Data agendada', type: 'date', span: 1, showIf: (v) => v.status === 'agendada' },
    { name: 'performed_date', label: 'Data de execução', type: 'date', span: 1, showIf: (v) => v.status === 'concluida' },
    { name: 'hour_meter', label: 'Horímetro na manutenção', type: 'number', min: 0, suffix: 'h', span: 1 },
    { name: 'description', label: 'Serviço realizado / peças', type: 'textarea', required: true, maxLength: 2000, span: 3 },
    { name: 'parts_cost', label: 'Peças', type: 'money', min: 0, span: 1 },
    { name: 'labor_cost', label: 'Mão de obra', type: 'money', min: 0, span: 1 },
    { name: 'provider', label: 'Oficina / prestador', type: 'text', maxLength: 120, span: 1 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]
  const usageCols: Column<Usage>[] = [
    { key: 'date', header: 'Data', sortable: true, value: (r) => r.usage_date, cell: (r) => formatDate(r.usage_date) },
    { key: 'hours', header: 'Horas', align: 'right', value: (r) => Number(r.hours ?? 0), cell: (r) => (r.hours ? formatNumber(r.hours, 1) : '—') },
    { key: 'hm', header: 'Horímetro final', align: 'right', value: (r) => Number(r.hour_meter_end ?? 0), cell: (r) => (r.hour_meter_end ? formatNumber(r.hour_meter_end, 1) : '—') },
    { key: 'fuel', header: 'Combustível', align: 'right', value: (r) => Number(r.fuel_liters ?? 0), cell: (r) => (r.fuel_liters ? `${formatNumber(r.fuel_liters, 0)} L` : '—') },
    { key: 'cost', header: 'Custo', align: 'right', value: (r) => Number(r.fuel_cost ?? 0), cell: (r) => formatBRL(r.fuel_cost) },
    { key: 'op', header: 'Operador', primary: true, value: (r) => r.employees?.full_name, cell: (r) => r.employees?.full_name ?? '—' },
    { key: 'where', header: 'Talhão / atividade', value: (r) => r.fields?.name, cell: (r) => [r.fields?.name, r.activities?.title].filter(Boolean).join(' · ') || '—' },
  ]
  const maintCols: Column<Maint>[] = [
    { key: 'date', header: 'Data', sortable: true, value: (r) => r.performed_date ?? r.scheduled_date, cell: (r) => formatDate(r.performed_date ?? r.scheduled_date) },
    { key: 'kind', header: 'Tipo', value: (r) => r.kind, cell: (r) => <Badge tone={r.kind === 'preventiva' ? 'blue' : 'yellow'}>{r.kind === 'preventiva' ? 'Preventiva' : 'Corretiva'}</Badge> },
    { key: 'desc', header: 'Serviço', primary: true, value: (r) => r.description, cell: (r) => <span className="line-clamp-2">{r.description}</span> },
    { key: 'status', header: 'Situação', value: (r) => r.status, cell: (r) => <Badge tone={r.status === 'concluida' ? 'green' : r.status === 'agendada' ? 'blue' : 'neutral'}>{r.status === 'concluida' ? 'Concluída' : r.status === 'agendada' ? 'Agendada' : 'Cancelada'}</Badge> },
    { key: 'hm', header: 'Horímetro', align: 'right', value: (r) => Number(r.hour_meter ?? 0), cell: (r) => (r.hour_meter ? `${formatNumber(r.hour_meter, 0)} h` : '—') },
    { key: 'cost', header: 'Custo', align: 'right', value: (r) => Number(r.total_cost), cell: (r) => formatBRL(r.total_cost) },
  ]

  return (
    <>
      <PageHeader title={e.name} badge={<><Badge tone={st.tone}>{st.label}</Badge>{e.is_demo && <DataStateBadge state="demo" />}</>}
        crumbs={[{ label: 'Gestão' }, { label: 'Máquinas', to: '/maquinas' }, { label: e.name }]}
        description={[EQUIP_KINDS.find((k) => k.value === e.kind)?.label, e.brand, e.model, e.year].filter(Boolean).join(' · ')}
        actions={<>
          {can('equipment', 'create') && <Button variant="outline" onClick={() => setUsageOpen(true)}><Fuel className="h-4 w-4" />Registrar uso</Button>}
          {can('equipment', 'create') && <Button variant="outline" onClick={() => setMaint({})}><Wrench className="h-4 w-4" />Manutenção</Button>}
          {can('equipment', 'edit') && <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Editar</Button>}
        </>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Horímetro" value={`${formatNumber(e.hour_meter, 1)} h`} hint={Number(e.odometer_km) ? `${formatNumber(e.odometer_km, 0)} km` : undefined} />
        <StatCard label="Próxima manutenção" value={<Badge tone={m.tone} className="text-sm">{m.label}</Badge>} hint={[m.nextHours !== null && `aos ${formatNumber(m.nextHours, 0)} h`, m.nextDate && `até ${formatDate(m.nextDate)}`].filter(Boolean).join(' ou ') || 'Defina intervalo de revisão'} />
        <StatCard label="Consumo registrado" value={`${formatNumber(totalFuel, 0)} L`} hint={totalHours ? `${formatNumber(totalFuel / totalHours, 1)} L/h médio` : undefined} />
        <StatCard label="Custo total (combustível + manutenção)" value={formatBRL(fuelCost + maintCost)} hint={totalHours ? `${formatBRL((fuelCost + maintCost) / totalHours)}/h` : undefined} />
      </div>
      <Card className="mb-5">
        <CardHeader title="Cadastro" />
        <div className="p-5"><KeyValue items={[
          { label: 'Código interno', value: e.identifier }, { label: 'Série/chassi', value: e.serial_number }, { label: 'Placa', value: e.plate },
          { label: 'Propriedade', value: (e.farms as { name: string } | null)?.name ?? 'Compartilhado' }, { label: 'Combustível', value: e.fuel_type },
          { label: 'Aquisição', value: e.acquisition_date ? `${formatDate(e.acquisition_date)} · ${formatBRL(e.acquisition_value)}` : null },
          { label: 'Última manutenção', value: e.last_maintenance_date ? `${formatDate(e.last_maintenance_date)} · ${formatNumber(e.last_maintenance_hours, 0)} h` : 'Não registrada' },
          { label: 'Plano preventivo', value: [e.maintenance_interval_hours && `${formatNumber(e.maintenance_interval_hours, 0)} h`, e.maintenance_interval_days && `${e.maintenance_interval_days} dias`].filter(Boolean).join(' ou ') || '—' },
        ]} />
          <div className="mt-3 text-xs"><Link className="text-brand-700 underline" to={`/documentos?equipamento=${id}`}>Documentos do equipamento</Link></div>
        </div>
      </Card>
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'manutencoes', label: 'Manutenções', count: maints.data?.length }, { value: 'uso', label: 'Uso e consumo', count: u.length }]} />
      {tab === 'uso' && <DataTable rows={u} columns={usageCols} loading={usage.isLoading} error={usage.error} exportName={`Uso ${e.name}`} />}
      {tab === 'manutencoes' && <DataTable rows={maints.data} columns={maintCols} loading={maints.isLoading} error={maints.error} exportName={`Manutenções ${e.name}`} onRowClick={(r) => can('equipment', 'edit') && setMaint(r)} />}

      <ResourceFormDialog open={edit} onOpenChange={setEdit} title="Editar equipamento" fields={equipmentFields(farms).map((f) => (f.name === 'hour_meter' ? { ...f, hint: 'Use “Registrar uso” para atualizações rotineiras' } : f))} initial={e} onSubmit={(v) => update.mutateAsync(v)} />
      <ResourceFormDialog open={usageOpen} onOpenChange={setUsageOpen} title="Registrar uso" fields={usageFields} defaults={{ usage_date: toISODate() }} onSubmit={(v) => addUsage.mutateAsync(v)}
        refine={(v) => (!v.hours && !v.hour_meter_end && !v.km && !v.fuel_liters ? 'Informe horas, horímetro, km ou combustível' : null)} />
      <ResourceFormDialog open={!!maint} onOpenChange={(o) => !o && setMaint(null)} title={maint?.id ? 'Editar manutenção' : 'Registrar manutenção'} fields={maintFields} initial={maint}
        defaults={{ kind: 'preventiva', status: 'concluida', performed_date: toISODate(), hour_meter: e.hour_meter, parts_cost: 0, labor_cost: 0 }} onSubmit={(v) => saveMaint.mutateAsync(v)} />
    </>
  )
}
