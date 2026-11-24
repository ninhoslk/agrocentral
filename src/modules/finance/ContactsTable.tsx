import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { Badge, Button } from '@/components/ui/primitives'
import { DataTable } from '@/components/tables/DataTable'
import { DemoBadge } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { UFS } from '@/services/providers/ibge'
import type { Tables } from '@/types/database'

const KINDS = [{ value: 'fornecedor', label: 'Fornecedor' }, { value: 'cliente', label: 'Cliente' }, { value: 'ambos', label: 'Fornecedor e cliente' }, { value: 'outro', label: 'Outro' }]
const fields: FieldDef[] = [
  { name: 'name', label: 'Nome / razão social', type: 'text', required: true, maxLength: 160, span: 2 },
  { name: 'kind', label: 'Tipo', type: 'select', required: true, options: KINDS, span: 1 },
  { name: 'document', label: 'CPF/CNPJ', type: 'text', maxLength: 20, span: 1 },
  { name: 'phone', label: 'Telefone', type: 'tel', maxLength: 30, span: 1 },
  { name: 'email', label: 'E-mail', type: 'email', span: 1 },
  { name: 'city', label: 'Município', type: 'text', maxLength: 120, span: 2 },
  { name: 'state', label: 'UF', type: 'select', options: UFS.map((u) => ({ value: u, label: u })), span: 1 },
  { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
]

/** Fornecedores e clientes — compartilhados entre Financeiro e Estoque. */
export function ContactsTable({ module }: { module: 'finance' | 'inventory' }) {
  const { orgId, can } = useCurrentOrg()
  const [edit, setEdit] = useState<Partial<Tables<'contacts'>> | null>(null)
  const q = useQuery({ queryKey: ['contacts', orgId], queryFn: () => unwrap(supabase.from('contacts').select('*').eq('organization_id', orgId).is('archived_at', null).order('name')) })
  const save = useAppMutation(async (v: Record<string, unknown>) => edit?.id ? unwrap(supabase.from('contacts').update(v as never).eq('id', edit.id)) : unwrap(supabase.from('contacts').insert({ ...v, organization_id: orgId } as never)),
    { invalidate: [['contacts'], ['lk-contacts']] })
  return (
    <>
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} exportName="Fornecedores e clientes" onRowClick={(r) => can(module, 'edit') && setEdit(r)}
        toolbar={can(module, 'create') ? <Button size="sm" onClick={() => setEdit({})}><Plus className="h-4 w-4" />Novo contato</Button> : undefined}
        columns={[
          { key: 'name', header: 'Nome', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.name}<DemoBadge show={r.is_demo} /></span> },
          { key: 'kind', header: 'Tipo', value: (r) => r.kind, cell: (r) => <Badge>{KINDS.find((k) => k.value === r.kind)?.label}</Badge> },
          { key: 'doc', header: 'CPF/CNPJ', value: (r) => r.document, cell: (r) => r.document ?? '—' },
          { key: 'contact', header: 'Contato', value: (r) => r.phone ?? r.email, cell: (r) => r.phone ?? r.email ?? '—' },
          { key: 'city', header: 'Cidade', value: (r) => r.city, cell: (r) => (r.city ? `${r.city}/${r.state ?? ''}` : '—') },
        ]} />
      <ResourceFormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? 'Editar contato' : 'Novo contato'} fields={fields} initial={edit}
        defaults={{ kind: module === 'inventory' ? 'fornecedor' : 'fornecedor' }} onSubmit={(v) => save.mutateAsync(v)} />
    </>
  )
}
