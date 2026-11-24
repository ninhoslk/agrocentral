import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownToLine, Boxes, Plus } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button, Tabs } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatBRL, formatDate, formatDateTime, formatNumber, toISODate, addDays } from '@/lib/format'
import { ContactsTable } from '@/modules/finance/ContactsTable'
import type { Tables } from '@/types/database'

export const ITEM_CATEGORIES = [
  { value: 'semente', label: 'Sementes' }, { value: 'fertilizante', label: 'Fertilizantes' }, { value: 'defensivo', label: 'Defensivos' },
  { value: 'combustivel', label: 'Combustível' }, { value: 'lubrificante', label: 'Lubrificantes' }, { value: 'peca', label: 'Peças' },
  { value: 'material', label: 'Materiais' }, { value: 'produto_colhido', label: 'Produção armazenada' }, { value: 'outro', label: 'Outros' },
]
const UNITS = ['kg', 't', 'g', 'L', 'mL', 'un', 'sc', 'cx', 'm', 'bag'].map((u) => ({ value: u, label: u }))
const KIND = { entrada: { label: 'Entrada', tone: 'green' }, saida: { label: 'Saída', tone: 'red' }, ajuste: { label: 'Ajuste', tone: 'yellow' }, transferencia: { label: 'Transferência', tone: 'blue' } } as const

type Item = Tables<'inventory_items'> & { contacts: { name: string } | null; inventory_locations: { name: string } | null }
type Mov = Tables<'stock_movements'> & { inventory_items: { name: string; unit: string } | null; fields: { name: string } | null; activities: { title: string | null } | null }
type Lot = Tables<'stock_lots'> & { inventory_items: { name: string; unit: string } | null }

export function InventoryPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const lk = useLookups()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'itens' | 'movimentacoes' | 'lotes' | 'locais' | 'fornecedores'>('itens')
  const [item, setItem] = useState<Partial<Item> | null>(null)
  const [mov, setMov] = useState<{ item_id?: string; kind?: string } | null>(null)
  const [loc, setLoc] = useState(false)
  const [itemFilter, setItemFilter] = useState<string | null>(params.get('item'))

  useEffect(() => { if (params.get('item')) { setTab('movimentacoes'); setItemFilter(params.get('item')) } }, [params])

  const items = useQuery({ queryKey: ['inventory', 'items', orgId, farmId], queryFn: () => { let q = supabase.from('inventory_items').select('*, contacts(name), inventory_locations(name)').eq('organization_id', orgId).is('archived_at', null).order('name'); if (farmId) q = q.or(`farm_id.eq.${farmId},farm_id.is.null`); return unwrap(q) as unknown as Promise<Item[]> } })
  const movs = useQuery({ queryKey: ['inventory', 'movs', orgId, farmId, itemFilter], enabled: tab === 'movimentacoes', queryFn: () => { let q = supabase.from('stock_movements').select('*, inventory_items(name, unit), fields(name), activities(title)').eq('organization_id', orgId).order('occurred_at', { ascending: false }).limit(500); if (itemFilter) q = q.eq('item_id', itemFilter); if (farmId) q = q.or(`farm_id.eq.${farmId},farm_id.is.null`); return unwrap(q) as unknown as Promise<Mov[]> } })
  const lots = useQuery({ queryKey: ['inventory', 'lots', orgId], enabled: tab === 'lotes', queryFn: () => unwrap(supabase.from('stock_lots').select('*, inventory_items(name, unit)').eq('organization_id', orgId).gt('quantity', 0).order('expires_at', { ascending: true, nullsFirst: false })) as unknown as Promise<Lot[]> })
  const locs = useQuery({ queryKey: ['inventory', 'locs', orgId], enabled: tab === 'locais', queryFn: () => unwrap(supabase.from('inventory_locations').select('*, farms(name)').eq('organization_id', orgId).order('name')) })

  const inval = [['inventory'], ['lk-items'], ['dashboard'], ['lk-locations']]
  const saveItem = useAppMutation(async (v: Record<string, unknown>) => {
    const { initial_quantity, initial_cost, ...rest } = v as Record<string, unknown> & { initial_quantity?: number; initial_cost?: number }
    if (item?.id) return unwrap(supabase.from('inventory_items').update(rest as never).eq('id', item.id))
    const created = await unwrap(supabase.from('inventory_items').insert({ ...rest, organization_id: orgId } as never).select('id, farm_id').single())
    if (initial_quantity && initial_quantity > 0) {
      await unwrap(supabase.from('stock_movements').insert({ organization_id: orgId, item_id: created.id, farm_id: created.farm_id, kind: 'entrada', quantity: initial_quantity, unit_cost: initial_cost ?? 0, notes: 'Saldo inicial' }))
    }
    return created
  }, { invalidate: inval })
  const archiveItem = useAppMutation(async (id: string) => unwrap(supabase.from('inventory_items').update({ archived_at: new Date().toISOString() }).eq('id', id)), { invalidate: inval, success: 'Item arquivado' })
  const saveMov = useAppMutation(async (v: Record<string, unknown>) => {
    const qty = Number(v.quantity)
    const row = { ...v, organization_id: orgId, quantity: v.kind === 'ajuste' && v.adjust_sign === 'saida' ? -qty : qty }
    delete (row as Record<string, unknown>).adjust_sign
    return unwrap(supabase.from('stock_movements').insert(row as never))
  }, { invalidate: inval })
  const saveLoc = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('inventory_locations').insert({ ...v, organization_id: orgId } as never)), { invalidate: inval })

  const data = items.data ?? []
  const low = data.filter((i) => i.min_quantity !== null && Number(i.current_quantity) <= Number(i.min_quantity))
  const value = data.reduce((s, i) => s + Number(i.current_quantity) * Number(i.average_cost), 0)

  const itemFields: FieldDef[] = [
    { name: 'name', label: 'Nome do item', type: 'text', required: true, maxLength: 160, span: 3 },
    { name: 'category', label: 'Categoria', type: 'select', required: true, options: ITEM_CATEGORIES, span: 1 },
    { name: 'unit', label: 'Unidade', type: 'select', required: true, options: UNITS, span: 1, disabled: !!item?.id, hint: item?.id ? 'Não pode ser alterada (mantém o histórico coerente)' : undefined },
    { name: 'min_quantity', label: 'Estoque mínimo', type: 'number', min: 0, span: 1 },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), emptyOption: 'Compartilhado', span: 1 },
    { name: 'location_id', label: 'Local padrão', type: 'select', options: toOptions(lk.locations.data, (l) => l.name), span: 1 },
    { name: 'supplier_id', label: 'Fornecedor', type: 'select', options: toOptions(lk.contacts.data, (c) => c.name), span: 1 },
    { name: 'active_ingredient', label: 'Ingrediente ativo', type: 'text', maxLength: 160, span: 2, showIf: (v) => v.category === 'defensivo' },
    { name: 'registration_number', label: 'Registro MAPA', type: 'text', maxLength: 60, span: 1, showIf: (v) => ['defensivo', 'fertilizante', 'semente'].includes(v.category) },
    ...(item?.id ? [] : [
      { name: 'initial_quantity', label: 'Saldo inicial', type: 'number' as const, min: 0, span: 1 as const, hint: 'Gera uma movimentação de entrada' },
      { name: 'initial_cost', label: 'Custo unitário inicial', type: 'money' as const, min: 0, span: 1 as const },
    ]),
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]
  const movFields: FieldDef[] = [
    { name: 'item_id', label: 'Item', type: 'select', required: true, options: data.map((i) => ({ value: i.id, label: `${i.name} (saldo ${formatNumber(i.current_quantity)} ${i.unit})` })), span: 3 },
    { name: 'kind', label: 'Tipo', type: 'select', required: true, options: Object.entries(KIND).map(([value, k]) => ({ value, label: k.label })), span: 1 },
    { name: 'adjust_sign', label: 'Ajuste', type: 'select', options: [{ value: 'entrada', label: 'Aumentar saldo' }, { value: 'saida', label: 'Reduzir saldo' }], span: 1, showIf: (v) => v.kind === 'ajuste' },
    { name: 'quantity', label: 'Quantidade', type: 'number', required: true, min: 0.001, span: 1 },
    { name: 'unit_cost', label: 'Custo unitário', type: 'money', min: 0, span: 1, showIf: (v) => v.kind === 'entrada', hint: 'Atualiza o custo médio' },
    { name: 'occurred_at', label: 'Data/hora', type: 'datetime', required: true, span: 2 },
    { name: 'lot_code', label: 'Lote', type: 'text', maxLength: 60, span: 1 },
    { name: 'lot_expires_at', label: 'Validade do lote', type: 'date', span: 1, showIf: (v) => v.kind === 'entrada' },
    { name: 'location_to_id', label: 'Local de destino', type: 'select', options: toOptions(lk.locations.data, (l) => l.name), span: 2, showIf: (v) => v.kind === 'transferencia' || v.kind === 'entrada' },
    { name: 'contact_id', label: 'Fornecedor', type: 'select', options: toOptions(lk.contacts.data, (c) => c.name), span: 2, showIf: (v) => v.kind === 'entrada' },
    { name: 'field_id', label: 'Talhão (consumo)', type: 'select', options: toOptions(lk.fields.data, (f) => f.name), span: 1, showIf: (v) => v.kind === 'saida' },
    { name: 'season_id', label: 'Safra', type: 'select', options: toOptions(lk.seasons.data, (s) => s.name), span: 1, showIf: (v) => v.kind === 'saida' },
    { name: 'document_number', label: 'Nº do documento / NF', type: 'text', maxLength: 60, span: 1 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]

  const itemCols: Column<Item>[] = [
    { key: 'name', header: 'Item', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="flex items-center gap-2 font-medium">{r.name}<DemoBadge show={r.is_demo} /></span> },
    { key: 'cat', header: 'Categoria', sortable: true, value: (r) => ITEM_CATEGORIES.find((c) => c.value === r.category)?.label, cell: (r) => ITEM_CATEGORIES.find((c) => c.value === r.category)?.label },
    { key: 'qty', header: 'Saldo', align: 'right', sortable: true, value: (r) => Number(r.current_quantity), cell: (r) => {
      const isLow = r.min_quantity !== null && Number(r.current_quantity) <= Number(r.min_quantity)
      return <span className={isLow ? 'font-semibold text-danger' : ''}>{formatNumber(r.current_quantity, 3)} {r.unit}{isLow && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" aria-label="abaixo do mínimo" />}</span>
    } },
    { key: 'min', header: 'Mínimo', align: 'right', value: (r) => Number(r.min_quantity ?? 0), cell: (r) => (r.min_quantity !== null ? `${formatNumber(r.min_quantity)} ${r.unit}` : '—') },
    { key: 'avg', header: 'Custo médio', align: 'right', value: (r) => Number(r.average_cost), cell: (r) => `${formatBRL(r.average_cost)}/${r.unit}` },
    { key: 'value', header: 'Valor em estoque', align: 'right', sortable: true, value: (r) => Number(r.current_quantity) * Number(r.average_cost), cell: (r) => formatBRL(Number(r.current_quantity) * Number(r.average_cost)) },
    { key: 'loc', header: 'Local', value: (r) => r.inventory_locations?.name, cell: (r) => r.inventory_locations?.name ?? '—' },
    { key: 'sup', header: 'Fornecedor', hidden: true, value: (r) => r.contacts?.name, cell: (r) => r.contacts?.name ?? '—' },
    { key: 'act', header: '', align: 'right', cell: (r) => can('inventory', 'create') ? <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setMov({ item_id: r.id, kind: 'entrada' }) }}><ArrowDownToLine className="h-4 w-4" />Movimentar</Button> : null },
  ]
  const movCols: Column<Mov>[] = [
    { key: 'date', header: 'Data', sortable: true, value: (r) => r.occurred_at, cell: (r) => formatDateTime(r.occurred_at) },
    { key: 'item', header: 'Item', primary: true, value: (r) => r.inventory_items?.name, cell: (r) => <span className="font-medium">{r.inventory_items?.name}</span> },
    { key: 'kind', header: 'Tipo', value: (r) => r.kind, cell: (r) => <Badge tone={KIND[r.kind as keyof typeof KIND].tone}>{KIND[r.kind as keyof typeof KIND].label}</Badge> },
    { key: 'qty', header: 'Quantidade', align: 'right', value: (r) => Number(r.quantity), cell: (r) => `${r.kind === 'saida' ? '−' : Number(r.quantity) < 0 ? '' : '+'}${formatNumber(r.quantity, 3)} ${r.inventory_items?.unit}` },
    { key: 'bal', header: 'Saldo após', align: 'right', value: (r) => Number(r.balance_after), cell: (r) => formatNumber(r.balance_after, 3) },
    { key: 'cost', header: 'Valor', align: 'right', value: (r) => Number(r.total_cost), cell: (r) => formatBRL(r.total_cost) },
    { key: 'link', header: 'Vínculo', value: (r) => r.activities?.title ?? r.fields?.name ?? r.notes, cell: (r) => r.activities ? `Atividade: ${r.activities.title ?? '—'}` : r.fields?.name ?? r.notes ?? '—' },
    { key: 'lot', header: 'Lote', value: (r) => r.lot_code, cell: (r) => r.lot_code ?? '—' },
  ]
  const lotCols: Column<Lot>[] = [
    { key: 'item', header: 'Item', primary: true, value: (r) => r.inventory_items?.name, cell: (r) => r.inventory_items?.name },
    { key: 'lot', header: 'Lote', value: (r) => r.lot_code, cell: (r) => r.lot_code },
    { key: 'qty', header: 'Quantidade', align: 'right', value: (r) => Number(r.quantity), cell: (r) => `${formatNumber(r.quantity)} ${r.inventory_items?.unit}` },
    { key: 'exp', header: 'Validade', sortable: true, value: (r) => r.expires_at, cell: (r) => {
      if (!r.expires_at) return '—'
      const days = Math.round((new Date(r.expires_at).getTime() - Date.now()) / 86400000)
      return <span className="flex items-center gap-2">{formatDate(r.expires_at)}{days < 0 ? <Badge tone="red">Vencido</Badge> : days <= 30 ? <Badge tone="yellow">{days} dias</Badge> : null}</span>
    } },
  ]

  const filteredItemName = useMemo(() => data.find((i) => i.id === itemFilter)?.name, [data, itemFilter])
  return (
    <>
      <PageHeader title="Estoque e almoxarifado" crumbs={[{ label: 'Gestão' }, { label: 'Estoque' }]}
        description="Saldos e custo médio são atualizados exclusivamente por movimentações, dentro de transações consistentes. Correções são feitas por ajuste."
        actions={can('inventory', 'create') && <>
          <Button variant="outline" onClick={() => setMov({ kind: 'entrada' })}><ArrowDownToLine className="h-4 w-4" />Movimentação</Button>
          <Button onClick={() => setItem({})}><Plus className="h-4 w-4" />Novo item</Button>
        </>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Itens ativos" value={data.length} />
        <StatCard label="Valor em estoque" value={formatBRL(value)} hint="Saldo × custo médio" />
        <StatCard label="Abaixo do mínimo" value={low.length} tone={low.length ? 'bad' : 'default'} hint={low.slice(0, 3).map((i) => i.name).join(', ') || undefined} />
        <StatCard label="Lotes vencendo (30 dias)" value={<LotsExpiring />} />
      </div>
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'itens', label: 'Itens' }, { value: 'movimentacoes', label: 'Movimentações' }, { value: 'lotes', label: 'Lotes e validade' }, { value: 'locais', label: 'Locais' }, { value: 'fornecedores', label: 'Fornecedores' }]} />
      {tab === 'itens' && <DataTable rows={data} columns={itemCols} loading={items.isLoading} error={items.error} onRowClick={(r) => can('inventory', 'edit') && setItem(r)} exportName="Estoque"
        empty={<EmptyState icon={<Boxes className="h-6 w-6" />} title="Nenhum item" description="Cadastre sementes, fertilizantes, defensivos, combustível e peças." />} />}
      {tab === 'movimentacoes' && (
        <>
          {itemFilter && <div className="mb-2 flex items-center gap-2 text-sm">Filtrando por <Badge tone="brand">{filteredItemName ?? 'item'}</Badge><Button variant="ghost" size="sm" onClick={() => setItemFilter(null)}>Limpar</Button></div>}
          <DataTable rows={movs.data} columns={movCols} loading={movs.isLoading} error={movs.error} exportName="Movimentações de estoque" />
        </>
      )}
      {tab === 'lotes' && <DataTable rows={lots.data} columns={lotCols} loading={lots.isLoading} error={lots.error} exportName="Lotes" />}
      {tab === 'locais' && <DataTable rows={locs.data} loading={locs.isLoading} error={locs.error}
        columns={[{ key: 'name', header: 'Local', primary: true, cell: (r) => r.name, value: (r) => r.name }, { key: 'farm', header: 'Propriedade', cell: (r) => (r.farms as { name: string } | null)?.name ?? '—' }]}
        toolbar={can('inventory', 'create') ? <Button size="sm" onClick={() => setLoc(true)}><Plus className="h-4 w-4" />Novo local</Button> : undefined} />}
      {tab === 'fornecedores' && <ContactsTable module="inventory" />}

      <ResourceFormDialog open={!!item} onOpenChange={(o) => !o && setItem(null)} title={item?.id ? 'Editar item' : 'Novo item de estoque'} fields={itemFields} initial={item}
        defaults={{ farm_id: farmId, unit: 'kg', category: 'fertilizante' }} onSubmit={(v) => saveItem.mutateAsync(v)}
        extra={() => item?.id && can('inventory', 'delete') ? <Button variant="outline" className="text-danger" onClick={() => { archiveItem.mutate(item.id!); setItem(null) }}>Arquivar item</Button> : null} />
      <ResourceFormDialog open={!!mov} onOpenChange={(o) => !o && setMov(null)} title="Nova movimentação" fields={movFields}
        description="Saídas não podem deixar o saldo negativo. Para consumo em operações, prefira lançar o insumo no Diário de campo."
        defaults={{ ...mov, occurred_at: new Date().toISOString(), adjust_sign: 'entrada' }} onSubmit={(v) => saveMov.mutateAsync(v)} />
      <ResourceFormDialog open={loc} onOpenChange={setLoc} title="Novo local de armazenamento" size="md"
        fields={[{ name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 80, span: 2 }, { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), span: 1 }]}
        defaults={{ farm_id: farmId }} onSubmit={(v) => saveLoc.mutateAsync(v)} />
    </>
  )
}

function LotsExpiring() {
  const { orgId } = useCurrentOrg()
  const q = useQuery({ queryKey: ['inventory', 'lots-exp', orgId], queryFn: async () => {
    const { count } = await supabase.from('stock_lots').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gt('quantity', 0).lte('expires_at', toISODate(addDays(new Date(), 30)))
    return count ?? 0
  } })
  return <>{q.data ?? '—'}</>
}
