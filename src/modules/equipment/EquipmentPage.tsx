import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Tractor } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { formatDate, formatNumber } from '@/lib/format'
import { EQUIP_KINDS, EQUIP_STATUS, equipmentFields, maintenanceState } from './config'
import type { Tables } from '@/types/database'

type Eq = Tables<'equipment'> & { farms: { name: string } | null }

export function EquipmentPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const q = useQuery({ queryKey: ['equipment', orgId, farmId], queryFn: () => { let qb = supabase.from('equipment').select('*, farms(name)').eq('organization_id', orgId).is('archived_at', null).order('name'); if (farmId) qb = qb.or(`farm_id.eq.${farmId},farm_id.is.null`); return unwrap(qb) as unknown as Promise<Eq[]> } })
  const create = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('equipment').insert({ ...v, organization_id: orgId } as never).select('id').single()),
    { invalidate: [['equipment'], ['lk-equipment'], ['dashboard']], onSuccess: (r) => navigate(`/maquinas/${(r as { id: string }).id}`) })

  const data = q.data ?? []
  const states = data.map((e) => maintenanceState(e))
  const cols: Column<Eq>[] = [
    { key: 'name', header: 'Equipamento', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.name}<DemoBadge show={r.is_demo} /></span> },
    { key: 'kind', header: 'Tipo', sortable: true, value: (r) => EQUIP_KINDS.find((k) => k.value === r.kind)?.label, cell: (r) => EQUIP_KINDS.find((k) => k.value === r.kind)?.label },
    { key: 'model', header: 'Marca/modelo', value: (r) => `${r.brand ?? ''} ${r.model ?? ''}`, cell: (r) => [r.brand, r.model, r.year].filter(Boolean).join(' · ') || '—' },
    { key: 'hm', header: 'Horímetro', align: 'right', sortable: true, value: (r) => Number(r.hour_meter), cell: (r) => `${formatNumber(r.hour_meter, 1)} h` },
    { key: 'status', header: 'Situação', value: (r) => r.status, cell: (r) => { const s = EQUIP_STATUS[r.status as keyof typeof EQUIP_STATUS]; return <Badge tone={s.tone}>{s.label}</Badge> } },
    { key: 'maint', header: 'Manutenção', value: (r) => maintenanceState(r).label, cell: (r) => { const m = maintenanceState(r); return <span className="flex flex-col"><Badge tone={m.tone}>{m.label}</Badge><span className="text-[11px] text-muted">{[m.nextHours !== null && `${formatNumber(m.nextHours, 0)} h`, m.nextDate && formatDate(m.nextDate)].filter(Boolean).join(' ou ')}</span></span> } },
    { key: 'farm', header: 'Propriedade', value: (r) => r.farms?.name, cell: (r) => r.farms?.name ?? 'Compartilhado' },
  ]
  return (
    <>
      <PageHeader title="Máquinas e equipamentos" crumbs={[{ label: 'Gestão' }, { label: 'Máquinas' }]}
        description="Cadastro, horímetro, uso, consumo, manutenções preventivas e corretivas, com alertas por horas ou data."
        actions={can('equipment', 'create') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Novo equipamento</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Equipamentos" value={data.length} />
        <StatCard label="Ativos" value={data.filter((e) => e.status === 'ativo').length} />
        <StatCard label="Manutenção vencida" value={states.filter((s) => s.label === 'Vencida').length} tone={states.some((s) => s.label === 'Vencida') ? 'bad' : 'default'} />
        <StatCard label="Manutenção próxima" value={states.filter((s) => s.label === 'Próxima').length} tone={states.some((s) => s.label === 'Próxima') ? 'warn' : 'default'} />
      </div>
      <DataTable rows={data} columns={cols} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} onRowClick={(r) => navigate(`/maquinas/${r.id}`)} exportName="Máquinas e equipamentos"
        empty={<EmptyState icon={<Tractor className="h-6 w-6" />} title="Nenhum equipamento" description="Cadastre tratores, colheitadeiras, implementos e veículos." />} />
      <ResourceFormDialog open={open} onOpenChange={setOpen} title="Novo equipamento" fields={equipmentFields(farms)} defaults={{ status: 'ativo', kind: 'trator', farm_id: farmId, hour_meter: 0, odometer_km: 0 }}
        onSubmit={(v) => create.mutateAsync(v)} />
    </>
  )
}
