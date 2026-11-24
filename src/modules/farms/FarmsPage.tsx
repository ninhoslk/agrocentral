import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPinned, Plus } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { EmptyState, DemoBadge } from '@/components/feedback/states'
import { ResourceFormDialog } from '@/components/forms/ResourceForm'
import { formatArea } from '@/lib/format'
import { farmFields, TENURE_LABEL } from './config'
import type { Tables } from '@/types/database'

type Farm = Tables<'farms'> & { fields: { count: number }[] }

export function FarmsPage() {
  const { orgId, can, refresh } = useCurrentOrg()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const q = useQuery({
    queryKey: ['farms', orgId, showArchived],
    queryFn: async () => {
      let qb = supabase.from('farms').select('*, fields(count)').eq('organization_id', orgId).order('name')
      qb = showArchived ? qb.not('archived_at', 'is', null) : qb.is('archived_at', null)
      return unwrap(qb) as Promise<Farm[]>
    },
  })

  const create = useAppMutation(
    async (v: Record<string, unknown>) => unwrap(supabase.from('farms').insert({ ...v, organization_id: orgId } as never).select('id').single()),
    { invalidate: [['farms'], ['farms-lite'], ['dashboard']], onSuccess: (r) => { refresh(); navigate(`/propriedades/${(r as { id: string }).id}`) } },
  )

  const columns: Column<Farm>[] = [
    { key: 'name', header: 'Propriedade', primary: true, sortable: true, value: (r) => r.name,
      cell: (r) => <span className="flex flex-wrap items-center gap-2 font-medium">{r.name}<DemoBadge show={r.is_demo} /></span> },
    { key: 'city', header: 'Município/UF', sortable: true, value: (r) => `${r.city ?? ''}/${r.state ?? ''}`, cell: (r) => (r.city ? `${r.city}/${r.state ?? ''}` : '—') },
    { key: 'area', header: 'Área total', align: 'right', sortable: true, value: (r) => Number(r.total_area_ha ?? r.boundary_area_ha ?? 0), cell: (r) => formatArea(r.total_area_ha ?? r.boundary_area_ha) },
    { key: 'prod', header: 'Área produtiva', align: 'right', value: (r) => Number(r.productive_area_ha ?? 0), cell: (r) => formatArea(r.productive_area_ha) },
    { key: 'fields', header: 'Talhões', align: 'right', value: (r) => r.fields?.[0]?.count ?? 0, cell: (r) => r.fields?.[0]?.count ?? 0 },
    { key: 'tenure', header: 'Posse', value: (r) => TENURE_LABEL[r.tenure_type ?? ''] ?? '', cell: (r) => TENURE_LABEL[r.tenure_type ?? ''] ?? '—' },
    { key: 'map', header: 'Limite no mapa', value: (r) => (r.boundary_geojson ? 'Sim' : 'Não'),
      cell: (r) => (r.boundary_geojson ? <Badge tone="green">{formatArea(r.boundary_area_ha)}</Badge> : <Badge>Sem limite</Badge>) },
  ]

  return (
    <>
      <PageHeader
        title="Propriedades"
        description="Cadastre suas fazendas, limites geográficos, áreas e documentos."
        crumbs={[{ label: 'Minha fazenda' }, { label: 'Propriedades' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowArchived((s) => !s)}>{showArchived ? 'Ver ativas' : 'Ver arquivadas'}</Button>
            {can('farms', 'create') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova propriedade</Button>}
          </>
        }
      />
      <DataTable
        rows={q.data}
        columns={columns}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(r) => navigate(`/propriedades/${r.id}`)}
        exportName="Propriedades"
        initialSort={{ key: 'name', dir: 'asc' }}
        empty={
          <EmptyState icon={<MapPinned className="h-6 w-6" />} title={showArchived ? 'Nenhuma propriedade arquivada' : 'Nenhuma propriedade cadastrada'}
            description="Cadastre a primeira propriedade para começar a organizar talhões, safras e operações."
            action={!showArchived && can('farms', 'create') ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Cadastrar propriedade</Button> : undefined} />
        }
      />
      <ResourceFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Nova propriedade"
        fields={farmFields}
        defaults={{ tenure_type: 'propria' }}
        onSubmit={(v) => create.mutateAsync(v)}
        refine={(v) => (v.productive_area_ha && v.total_area_ha && v.productive_area_ha > v.total_area_ha ? 'Área produtiva maior que a área total' : null)}
      />
    </>
  )
}
