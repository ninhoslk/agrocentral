import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Pencil, PiggyBank, Plus, Trash2, Wheat } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { KeyValue, PageHeader, StatCard } from '@/components/ui/layout'
import { Badge, Button, Card, CardHeader, Tabs } from '@/components/ui/primitives'
import { Dropdown, useConfirm } from '@/components/ui/overlay'
import { DataStateBadge, EmptyState, ErrorState, LoadingRows } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { formatArea, formatBRL, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { DESTINATIONS, HARVEST_UNITS, SEASON_STATUS, SEASON_TRANSITIONS } from './config'
import { seasonFormFields } from './SeasonsPage'

type Tab = 'talhoes' | 'colheitas' | 'atividades' | 'resultado'

export function SeasonDetailPage() {
  const { id = '' } = useParams()
  const { orgId, farms, can, moduleEnabled } = useCurrentOrg()
  const lk = useLookups()
  const [tab, setTab] = useState<Tab>('talhoes')
  const [edit, setEdit] = useState(false)
  const [sfDialog, setSfDialog] = useState<Record<string, unknown> | null>(null)
  const [harvestOpen, setHarvestOpen] = useState(false)
  const [varietyOpen, setVarietyOpen] = useState(false)
  const { confirm, node } = useConfirm()

  const season = useQuery({ queryKey: ['season', id], queryFn: () => unwrap(supabase.from('seasons').select('*, farms(id, name), crops(id, name, yield_unit, sack_weight_kg), employees(full_name)').eq('id', id).single()) })
  const sfs = useQuery({ queryKey: ['season-fields', id], queryFn: () => unwrap(supabase.from('season_fields').select('*, fields(name, area_ha, manual_area_ha), varieties(name)').eq('season_id', id).order('created_at')) })
  const harvests = useQuery({ queryKey: ['season-harvests', id], queryFn: () => unwrap(supabase.from('harvest_records').select('*, fields(name)').eq('season_id', id).order('harvest_date', { ascending: false })) })
  const acts = useQuery({ queryKey: ['season-acts', id], queryFn: () => unwrap(supabase.from('activities').select('id, title, status, started_at, labor_cost, other_cost, inputs_cost, activity_types(name), fields(name)').eq('season_id', id).order('started_at', { ascending: false })) })
  const txs = useQuery({ queryKey: ['season-txs', id], enabled: can('finance'), queryFn: () => unwrap(supabase.from('transactions').select('kind, amount, status').eq('season_id', id)) })

  const inval = [['season', id], ['seasons'], ['season-fields', id], ['season-harvests', id], ['dashboard'], ['lk-seasons'], ['lk-season-fields'], ['current-crops']]
  const update = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('seasons').update(v as never).eq('id', id)), { invalidate: inval })
  const upsertSf = useAppMutation(async (v: Record<string, unknown>) => {
    if (v.id) return unwrap(supabase.from('season_fields').update(v as never).eq('id', v.id as string))
    return unwrap(supabase.from('season_fields').insert({ ...v, organization_id: orgId, season_id: id } as never))
  }, { invalidate: inval })
  const removeSf = useAppMutation(async (sfId: string) => unwrap(supabase.from('season_fields').delete().eq('id', sfId)), { invalidate: inval, success: 'Talhão desvinculado' })
  const addHarvest = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('harvest_records').insert({ ...v, organization_id: orgId, season_id: id } as never)), { invalidate: inval })
  const removeHarvest = useAppMutation(async (hid: string) => unwrap(supabase.from('harvest_records').delete().eq('id', hid)), { invalidate: inval, success: 'Colheita removida' })
  const addVariety = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('varieties').insert({ ...v, organization_id: orgId, crop_id: season.data!.crop_id } as never)), { invalidate: [['lk-varieties']] })

  const s = season.data
  const crop = s?.crops as { id: string; name: string; yield_unit: string; sack_weight_kg: number | null } | undefined
  const area = (sfs.data ?? []).reduce((a, x) => a + Number(x.planted_area_ha ?? 0), 0)
  const kg = (harvests.data ?? []).reduce((a, x) => a + Number(x.quantity_kg ?? 0), 0)
  const sk = crop?.sack_weight_kg ? Number(crop.sack_weight_kg) : null
  const sacks = sk ? kg / sk : null
  const opCost = (acts.data ?? []).filter((a) => a.status !== 'cancelada').reduce((a, x) => a + Number(x.labor_cost) + Number(x.other_cost) + Number(x.inputs_cost), 0)
  const expenses = (txs.data ?? []).filter((t) => t.kind === 'despesa' && t.status !== 'cancelado').reduce((a, x) => a + Number(x.amount), 0)
  const revenue = (txs.data ?? []).filter((t) => t.kind === 'receita' && t.status !== 'cancelado').reduce((a, x) => a + Number(x.amount), 0)
  const expectedProd = (sfs.data ?? []).reduce((a, x) => a + Number(x.planted_area_ha ?? 0) * Number(x.expected_yield_per_ha ?? s?.expected_yield_per_ha ?? 0), 0)

  const linkedIds = useMemo(() => new Set((sfs.data ?? []).map((x) => x.field_id)), [sfs.data])
  const farmFields = (lk.fields.data ?? []).filter((f) => f.farm_id === s?.farm_id)
  const varieties = (lk.varieties.data ?? []).filter((v) => v.crop_id === s?.crop_id)

  if (season.isLoading) return <LoadingRows rows={8} />
  if (season.error || !s) return <ErrorState error={season.error} onRetry={() => season.refetch()} />

  const sfFields: FieldDef[] = [
    ...(sfDialog?.id ? [] : [{ name: 'field_id', label: 'Talhão', type: 'select' as const, required: true, options: farmFields.filter((f) => !linkedIds.has(f.id)).map((f) => ({ value: f.id, label: `${f.name} (${formatArea(f.area_ha ?? f.manual_area_ha)})` })), span: 3 as const }]),
    { name: 'variety_id', label: 'Variedade / híbrido', type: 'select', options: toOptions(varieties, (v) => v.name), span: 2, hint: varieties.length ? undefined : 'Cadastre variedades em “Variedades”.' },
    { name: 'planted_area_ha', label: 'Área plantada', type: 'number', min: 0.0001, suffix: 'ha', span: 1, hint: 'Vazio = área do talhão' },
    { name: 'planting_date', label: 'Data de plantio', type: 'date', span: 1 },
    { name: 'expected_harvest_date', label: 'Colheita prevista', type: 'date', span: 1 },
    { name: 'stage', label: 'Estágio atual', type: 'text', maxLength: 60, span: 1, placeholder: 'Ex.: V6, R1, Florada' },
    { name: 'population_per_ha', label: 'População', type: 'number', min: 0, suffix: 'pl/ha', span: 1 },
    { name: 'seed_rate_kg_ha', label: 'Sementes', type: 'number', min: 0, suffix: 'kg/ha', span: 1 },
    { name: 'expected_yield_per_ha', label: 'Produtividade esperada', type: 'number', min: 0, suffix: `${crop?.yield_unit ?? 'un'}/ha`, span: 1 },
    { name: 'seed_supplier', label: 'Fornecedor de sementes', type: 'text', maxLength: 120, span: 2 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]
  const harvestFields: FieldDef[] = [
    { name: 'field_id', label: 'Talhão (da safra)', type: 'select', required: true, options: (sfs.data ?? []).map((x) => ({ value: x.field_id, label: (x.fields as { name: string } | null)?.name ?? '' })), span: 2 },
    { name: 'harvest_date', label: 'Data', type: 'date', required: true, span: 1 },
    { name: 'quantity', label: 'Quantidade', type: 'number', required: true, min: 0.001, span: 1 },
    { name: 'unit', label: 'Unidade', type: 'select', required: true, options: HARVEST_UNITS, span: 1, hint: sk ? `Saca de ${sk} kg` : 'Cultura sem peso de saca: use kg, t ou @' },
    { name: 'moisture_pct', label: 'Umidade', type: 'number', min: 0, max: 100, suffix: '%', span: 1 },
    { name: 'impurity_pct', label: 'Impureza', type: 'number', min: 0, max: 100, suffix: '%', span: 1 },
    { name: 'losses_kg', label: 'Perdas', type: 'number', min: 0, suffix: 'kg', span: 1 },
    { name: 'destination', label: 'Destino', type: 'select', options: DESTINATIONS, span: 1 },
    { name: 'quality', label: 'Qualidade / classificação', type: 'text', maxLength: 80, span: 3 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]

  type SF = NonNullable<typeof sfs.data>[number]
  const sfCols: Column<SF>[] = [
    { key: 'field', header: 'Talhão', primary: true, value: (r) => (r.fields as { name: string } | null)?.name, cell: (r) => <Link className="font-medium text-brand-800 hover:underline" to={`/talhoes/${r.field_id}`}>{(r.fields as { name: string } | null)?.name}</Link> },
    { key: 'var', header: 'Variedade', value: (r) => (r.varieties as { name: string } | null)?.name, cell: (r) => (r.varieties as { name: string } | null)?.name ?? '—' },
    { key: 'area', header: 'Área plantada', align: 'right', value: (r) => Number(r.planted_area_ha), cell: (r) => formatArea(r.planted_area_ha) },
    { key: 'plant', header: 'Plantio', value: (r) => r.planting_date, cell: (r) => formatDate(r.planting_date) },
    { key: 'harv', header: 'Colheita prev.', value: (r) => r.expected_harvest_date, cell: (r) => formatDate(r.expected_harvest_date) },
    { key: 'stage', header: 'Estágio', value: (r) => r.stage, cell: (r) => r.stage ?? '—' },
    { key: 'exp', header: 'Prod. esperada', align: 'right', value: (r) => Number(r.expected_yield_per_ha ?? 0), cell: (r) => (r.expected_yield_per_ha ? `${formatNumber(r.expected_yield_per_ha, 1)} ${crop?.yield_unit}/ha` : '—') },
    { key: 'act', header: '', align: 'right', cell: (r) => can('seasons', 'edit') ? (
      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setSfDialog(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Desvincular" onClick={async () => { if (await confirm('Desvincular talhão da safra?', 'Só é possível se não houver colheitas ou atividades vinculadas a este talhão nesta safra.', 'Desvincular')) removeSf.mutate(r.id) }}><Trash2 className="h-4 w-4" /></Button>
      </span>) : null },
  ]
  type H = NonNullable<typeof harvests.data>[number]
  const hCols: Column<H>[] = [
    { key: 'date', header: 'Data', value: (r) => r.harvest_date, cell: (r) => formatDate(r.harvest_date) },
    { key: 'field', header: 'Talhão', primary: true, value: (r) => (r.fields as { name: string } | null)?.name, cell: (r) => (r.fields as { name: string } | null)?.name },
    { key: 'qty', header: 'Quantidade', align: 'right', value: (r) => Number(r.quantity), cell: (r) => `${formatNumber(r.quantity)} ${r.unit}` },
    { key: 'kg', header: 'Peso', align: 'right', value: (r) => Number(r.quantity_kg ?? 0), cell: (r) => (r.quantity_kg ? `${formatNumber(Number(r.quantity_kg) / 1000, 2)} t` : '—') },
    { key: 'moist', header: 'Umidade', align: 'right', value: (r) => r.moisture_pct, cell: (r) => (r.moisture_pct ? `${formatNumber(r.moisture_pct, 1)}%` : '—') },
    { key: 'dest', header: 'Destino', value: (r) => r.destination, cell: (r) => DESTINATIONS.find((d) => d.value === r.destination)?.label ?? '—' },
    { key: 'act', header: '', align: 'right', cell: (r) => can('seasons', 'delete') ? <Button variant="ghost" size="icon" aria-label="Remover" onClick={async () => { if (await confirm('Remover registro de colheita?', undefined, 'Remover')) removeHarvest.mutate(r.id) }}><Trash2 className="h-4 w-4" /></Button> : null },
  ]
  type A = NonNullable<typeof acts.data>[number]
  const aCols: Column<A>[] = [
    { key: 'date', header: 'Data', value: (r) => r.started_at, cell: (r) => formatDateTime(r.started_at) },
    { key: 'type', header: 'Atividade', primary: true, value: (r) => (r.activity_types as { name: string } | null)?.name, cell: (r) => <span className="font-medium">{(r.activity_types as { name: string } | null)?.name}{r.title && <span className="font-normal text-muted"> — {r.title}</span>}</span> },
    { key: 'field', header: 'Talhão', value: (r) => (r.fields as { name: string } | null)?.name, cell: (r) => (r.fields as { name: string } | null)?.name ?? '—' },
    { key: 'cost', header: 'Custo', align: 'right', value: (r) => Number(r.labor_cost) + Number(r.other_cost) + Number(r.inputs_cost), cell: (r) => formatBRL(Number(r.labor_cost) + Number(r.other_cost) + Number(r.inputs_cost)) },
  ]

  const st = SEASON_STATUS[s.status]
  return (
    <>
      <PageHeader title={s.name} badge={<><Badge tone={st.tone}>{st.label}</Badge>{s.is_demo && <DataStateBadge state="demo" />}</>}
        crumbs={[{ label: 'Minha fazenda' }, { label: 'Safras', to: '/safras' }, { label: s.name }]}
        description={`${crop?.name} · ${(s.farms as { name: string } | null)?.name} · ${formatDate(s.start_date)} – ${formatDate(s.end_date)}`}
        actions={<>
          {moduleEnabled('budget') && can('budget') && <Link to={`/orcamento?safra=${s.id}&aba=resumo`}><Button variant="secondary"><PiggyBank className="h-4 w-4" />Orçamento da safra</Button></Link>}
          {can('seasons', 'edit') && <>
          <Dropdown trigger={<Button variant="outline">Alterar status</Button>}
            items={(SEASON_TRANSITIONS[s.status] ?? []).map((to) => ({ label: SEASON_STATUS[to].label, onSelect: () => update.mutate({ status: to }) }))} />
          <Button variant="outline" onClick={() => setVarietyOpen(true)}>Variedades</Button>
          <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Editar</Button>
          </>}
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Área plantada" value={formatArea(area)} hint={`${sfs.data?.length ?? 0} talhão(ões)`} />
        <StatCard label="Produção estimada" value={expectedProd ? `${formatNumber(expectedProd, 0)} ${crop?.yield_unit}` : '—'} />
        <StatCard label="Produção realizada" value={sacks !== null ? `${formatNumber(sacks, 0)} sc` : kg ? `${formatNumber(kg / 1000, 1)} t` : '—'}
          hint={expectedProd && sacks ? `${formatNumber((sacks / expectedProd) * 100, 0)}% do estimado` : undefined} />
        <StatCard label="Produtividade" value={sacks && area ? `${formatNumber(sacks / area, 1)} sc/ha` : '—'} hint={s.expected_yield_per_ha ? `Meta: ${formatNumber(s.expected_yield_per_ha, 1)}` : undefined} />
        <StatCard label="Custo apurado" value={formatBRL(opCost + expenses)} hint={area ? `${formatBRL((opCost + expenses) / area)}/ha` : undefined} />
      </div>

      <Tabs value={tab} onChange={setTab} className="mb-4" items={[
        { value: 'talhoes', label: 'Talhões', count: sfs.data?.length }, { value: 'colheitas', label: 'Colheitas', count: harvests.data?.length },
        { value: 'atividades', label: 'Atividades', count: acts.data?.length }, { value: 'resultado', label: 'Resultado' },
      ]} />
      {tab === 'talhoes' && <DataTable rows={sfs.data} columns={sfCols} loading={sfs.isLoading} error={sfs.error} exportName={`Talhões ${s.name}`}
        toolbar={can('seasons', 'edit') ? <Button size="sm" onClick={() => setSfDialog({})} disabled={!farmFields.some((f) => !linkedIds.has(f.id))}><Plus className="h-4 w-4" />Vincular talhão</Button> : undefined}
        empty={<EmptyState title="Nenhum talhão vinculado" description="Vincule os talhões desta propriedade que fazem parte da safra." />} />}
      {tab === 'colheitas' && <DataTable rows={harvests.data} columns={hCols} loading={harvests.isLoading} error={harvests.error} exportName={`Colheitas ${s.name}`}
        toolbar={can('seasons', 'create') ? <Button size="sm" onClick={() => setHarvestOpen(true)} disabled={!sfs.data?.length}><Wheat className="h-4 w-4" />Registrar colheita</Button> : undefined}
        empty={<EmptyState title="Nenhuma colheita registrada" description={sfs.data?.length ? 'Registre a produção colhida por talhão.' : 'Vincule talhões antes de registrar colheitas.'} />} />}
      {tab === 'atividades' && <DataTable rows={acts.data} columns={aCols} loading={acts.isLoading} error={acts.error} exportName={`Atividades ${s.name}`}
        toolbar={<Link to={`/diario?safra=${id}`}><Button size="sm" variant="outline"><Plus className="h-4 w-4" />Registrar atividade</Button></Link>} />}
      {tab === 'resultado' && (
        <Card>
          <CardHeader title="Resultado da safra" description="Calculado a partir dos registros: atividades (mão de obra, insumos, outros) e lançamentos financeiros vinculados à safra." />
          <div className="p-5">
            <KeyValue items={[
              { label: 'Custo operacional (atividades)', value: formatBRL(opCost) },
              { label: 'Despesas lançadas na safra', value: can('finance') ? formatBRL(expenses) : 'Sem acesso ao financeiro' },
              { label: 'Custo total', value: formatBRL(opCost + expenses) },
              { label: 'Receitas lançadas na safra', value: can('finance') ? formatBRL(revenue) : '—' },
              { label: 'Margem', value: can('finance') ? <span className={revenue - opCost - expenses < 0 ? 'text-danger' : 'text-ok'}>{formatBRL(revenue - opCost - expenses)}</span> : '—' },
              { label: 'Custo por saca', value: sacks ? formatBRL((opCost + expenses) / sacks) : '—' },
              { label: 'Custo estimado (planejamento)', value: formatBRL(s.estimated_cost) },
              { label: 'Responsável', value: (s.employees as { full_name: string } | null)?.full_name },
            ]} />
            {s.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{s.notes}</p>}
          </div>
        </Card>
      )}

      <ResourceFormDialog open={edit} onOpenChange={setEdit} title="Editar safra" fields={seasonFormFields(farms, lk.crops.data ?? [], lk.employees.data ?? []).map((f) => (f.name === 'farm_id' || f.name === 'crop_id' ? { ...f, disabled: true, hint: 'Não pode ser alterado após a criação' } : f))}
        initial={s} onSubmit={(v) => { const { farm_id: _f, crop_id: _c, ...rest } = v; void _f; void _c; return update.mutateAsync(rest) }} />
      <ResourceFormDialog open={!!sfDialog} onOpenChange={(o) => !o && setSfDialog(null)} title={sfDialog?.id ? 'Editar talhão na safra' : 'Vincular talhão'} fields={sfFields} initial={sfDialog}
        onSubmit={(v) => upsertSf.mutateAsync(sfDialog?.id ? { ...v, id: sfDialog.id } : v)} />
      <ResourceFormDialog open={harvestOpen} onOpenChange={setHarvestOpen} title="Registrar colheita" fields={harvestFields}
        defaults={{ unit: sk ? 'sc' : 'kg', harvest_date: new Date().toISOString().slice(0, 10) }} onSubmit={(v) => addHarvest.mutateAsync(v)} />
      <ResourceFormDialog open={varietyOpen} onOpenChange={setVarietyOpen} title={`Nova variedade de ${crop?.name}`} size="md"
        description={varieties.length ? `Cadastradas: ${varieties.map((v) => v.name).join(', ')}` : 'Nenhuma variedade cadastrada para esta cultura.'}
        fields={[
          { name: 'name', label: 'Nome', type: 'text', required: true, maxLength: 120, span: 2 },
          { name: 'cycle_days', label: 'Ciclo', type: 'number', min: 1, max: 2000, suffix: 'dias', span: 1 },
          { name: 'supplier', label: 'Fornecedor/obtentor', type: 'text', maxLength: 120, span: 3 },
        ]} onSubmit={(v) => addVariety.mutateAsync(v)} />
      {node}
    </>
  )
}
