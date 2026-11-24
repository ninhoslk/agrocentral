import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, FileText, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, FieldWrap, Select } from '@/components/ui/primitives'
import { useConfirm } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DemoBadge, EmptyState } from '@/components/feedback/states'
import { ResourceFormDialog, type FieldDef } from '@/components/forms/ResourceForm'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { formatDate, formatNumber } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'
import type { Tables } from '@/types/database'

export const DOC_TYPES = [
  { value: 'contrato', label: 'Contrato' }, { value: 'nota_fiscal', label: 'Nota fiscal' }, { value: 'car', label: 'CAR' }, { value: 'ccir', label: 'CCIR' },
  { value: 'itr', label: 'ITR' }, { value: 'documento_maquina', label: 'Documento de máquina' }, { value: 'laudo', label: 'Laudo técnico' },
  { value: 'analise_solo', label: 'Análise de solo' }, { value: 'receita_agronomica', label: 'Receita agronômica' }, { value: 'comprovante', label: 'Comprovante' },
  { value: 'foto', label: 'Foto' }, { value: 'relatorio', label: 'Relatório' }, { value: 'outro', label: 'Outro' },
]
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'text/csv', 'text/plain', 'application/json', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', 'application/geo+json']
const MAX = 20 * 1024 * 1024

type Doc = Tables<'documents'> & { farms: { name: string } | null; fields: { name: string } | null; seasons: { name: string } | null; equipment: { name: string } | null }

function guessMime(f: File) {
  if (f.type) return f.type
  const ext = f.name.split('.').pop()?.toLowerCase()
  return ({ kml: 'application/vnd.google-earth.kml+xml', kmz: 'application/vnd.google-earth.kmz', geojson: 'application/geo+json', csv: 'text/csv' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream'
}

export function DocumentsPage() {
  const { orgId, farmId, farms, can } = useCurrentOrg()
  const lk = useLookups()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [edit, setEdit] = useState<Doc | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [expFilter, setExpFilter] = useState('')
  const { confirm, node } = useConfirm()
  const preset = { field_id: params.get('talhao'), equipment_id: params.get('equipamento'), farm_id: params.get('fazenda') ?? farmId }

  useEffect(() => { if (params.get('novo')) { fileRef.current?.click(); params.delete('novo'); setParams(params, { replace: true }) } }, [params, setParams])

  const q = useQuery({
    queryKey: ['documents', orgId, farmId, typeFilter, expFilter, preset.field_id, preset.equipment_id],
    queryFn: () => {
      let qb = supabase.from('documents').select('*, farms(name), fields(name), seasons(name), equipment(name)').eq('organization_id', orgId).is('archived_at', null).order('created_at', { ascending: false })
      if (farmId) qb = qb.or(`farm_id.eq.${farmId},farm_id.is.null`)
      if (typeFilter) qb = qb.eq('doc_type', typeFilter)
      if (preset.field_id) qb = qb.eq('field_id', preset.field_id)
      if (preset.equipment_id) qb = qb.eq('equipment_id', preset.equipment_id)
      if (expFilter === '30') { const d = new Date(); d.setDate(d.getDate() + 30); qb = qb.not('expires_at', 'is', null).lte('expires_at', d.toISOString().slice(0, 10)) }
      return unwrap(qb) as unknown as Promise<Doc[]>
    },
  })

  const metaFields: FieldDef[] = [
    { name: 'name', label: 'Nome do documento', type: 'text', required: true, maxLength: 200, span: 3 },
    { name: 'doc_type', label: 'Tipo', type: 'select', required: true, options: DOC_TYPES, span: 1 },
    { name: 'issue_date', label: 'Emissão', type: 'date', span: 1 },
    { name: 'expires_at', label: 'Validade', type: 'date', span: 1, hint: 'Gera lembrete 30 dias antes' },
    { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), span: 1 },
    { name: 'field_id', label: 'Talhão', type: 'select', options: toOptions(lk.fields.data, (f) => f.name), span: 1 },
    { name: 'season_id', label: 'Safra', type: 'select', options: toOptions(lk.seasons.data, (s) => s.name), span: 1 },
    { name: 'equipment_id', label: 'Equipamento', type: 'select', options: toOptions(lk.equipment.data, (e) => e.name), span: 1 },
    { name: 'responsible', label: 'Responsável', type: 'text', maxLength: 120, span: 1 },
    { name: 'tags', label: 'Tags', type: 'tags', span: 1 },
    { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 1000, span: 3 },
  ]

  const upload = async (v: Record<string, unknown>) => {
    if (!file) return
    const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)
    const path = `${orgId}/${crypto.randomUUID()}-${safe}`
    const mime = guessMime(file)
    const up = await supabase.storage.from('documents').upload(path, file, { contentType: mime, upsert: false })
    if (up.error) throw up.error
    const { error } = await supabase.from('documents').insert({ ...v, organization_id: orgId, storage_path: path, mime_type: mime, size_bytes: file.size } as never)
    if (error) { await supabase.storage.from('documents').remove([path]); throw error }
    setFile(null)
    qc.invalidateQueries({ queryKey: ['documents'] })
  }
  const updateMeta = useAppMutation(async (v: Record<string, unknown>) => unwrap(supabase.from('documents').update(v as never).eq('id', edit!.id)), { invalidate: [['documents']] })
  const remove = useAppMutation(async (d: Doc) => {
    await unwrap(supabase.from('documents').delete().eq('id', d.id))
    const { error } = await supabase.storage.from('documents').remove([d.storage_path])
    if (error) console.warn('Arquivo não removido do storage', error.message)
  }, { invalidate: [['documents']], success: 'Documento excluído' })

  const open = async (d: Doc, download: boolean) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60, download ? { download: d.name } : undefined)
    if (error || !data) { toast.error(toUserMessage(error)); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const onPick = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX) { toast.error('Arquivo maior que 20 MB'); return }
    if (!ALLOWED.includes(guessMime(f))) { toast.error('Tipo de arquivo não permitido. Use PDF, imagens, planilhas, documentos, CSV, KML/KMZ ou GeoJSON.'); return }
    setFile(f)
    if (fileRef.current) fileRef.current.value = ''
  }

  const today = new Date().toISOString().slice(0, 10)
  const cols: Column<Doc>[] = [
    { key: 'name', header: 'Documento', primary: true, sortable: true, value: (r) => r.name, cell: (r) => <span className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 shrink-0 text-muted" />{r.name}<DemoBadge show={r.is_demo} /></span> },
    { key: 'type', header: 'Tipo', sortable: true, value: (r) => DOC_TYPES.find((t) => t.value === r.doc_type)?.label, cell: (r) => <Badge>{DOC_TYPES.find((t) => t.value === r.doc_type)?.label}</Badge> },
    { key: 'link', header: 'Vínculo', value: (r) => [r.farms?.name, r.fields?.name, r.seasons?.name, r.equipment?.name].filter(Boolean).join(' · '), cell: (r) => [r.farms?.name, r.fields?.name, r.seasons?.name, r.equipment?.name].filter(Boolean).join(' · ') || '—' },
    { key: 'exp', header: 'Validade', sortable: true, value: (r) => r.expires_at, cell: (r) => !r.expires_at ? '—' : <span className="flex items-center gap-2">{formatDate(r.expires_at)}{r.expires_at < today ? <Badge tone="red">Vencido</Badge> : (new Date(r.expires_at).getTime() - Date.now()) / 86400000 <= 30 ? <Badge tone="yellow">Vence em breve</Badge> : null}</span> },
    { key: 'size', header: 'Tamanho', align: 'right', value: (r) => Number(r.size_bytes), cell: (r) => `${formatNumber(Number(r.size_bytes) / 1024 / 1024, 2)} MB` },
    { key: 'tags', header: 'Tags', hidden: true, value: (r) => r.tags.join(', '), cell: (r) => r.tags.join(', ') || '—' },
    { key: 'act', header: '', align: 'right', cell: (r) => (
      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" aria-label="Visualizar" onClick={() => void open(r, false)}><Eye className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Baixar" onClick={() => void open(r, true)}><Download className="h-4 w-4" /></Button>
        {can('documents', 'delete') && <Button variant="ghost" size="icon" aria-label="Excluir" onClick={async () => { if (await confirm('Excluir documento?', `“${r.name}” será removido permanentemente.`, 'Excluir')) remove.mutate(r) }}><Trash2 className="h-4 w-4" /></Button>}
      </span>) },
  ]

  return (
    <>
      <PageHeader title="Documentos" crumbs={[{ label: 'Gestão' }, { label: 'Documentos' }]}
        description="Repositório privado: arquivos acessados somente por usuários autorizados, via links temporários (60 s). Máximo de 20 MB por arquivo."
        actions={can('documents', 'create') && <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Enviar documento</Button>} />
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.docx,.xlsx,.doc,.xls,.csv,.txt,.kml,.kmz,.geojson,.json,.zip" />
      <div className="mb-4 flex flex-wrap gap-3">
        <FieldWrap label="Tipo" htmlFor="d-type"><Select id="d-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-52"><option value="">Todos</option>{DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></FieldWrap>
        <FieldWrap label="Validade" htmlFor="d-exp"><Select id="d-exp" value={expFilter} onChange={(e) => setExpFilter(e.target.value)} className="w-52"><option value="">Todas</option><option value="30">Vencidos ou vencendo em 30 dias</option></Select></FieldWrap>
        {(preset.field_id || preset.equipment_id) && <Button variant="ghost" size="sm" className="self-end" onClick={() => setParams({})}>Limpar filtro de vínculo</Button>}
      </div>
      <DataTable rows={q.data} columns={cols} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} onRowClick={(r) => can('documents', 'edit') && setEdit(r)} exportName="Documentos"
        empty={<EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum documento" description="Envie contratos, notas fiscais, CAR, CCIR, ITR, laudos e análises de solo." />} />
      <ResourceFormDialog open={!!file} onOpenChange={(o) => !o && setFile(null)} title="Enviar documento" description={file ? `${file.name} · ${formatNumber(file.size / 1024 / 1024, 2)} MB` : undefined}
        fields={metaFields} defaults={{ name: file?.name.replace(/\.[^.]+$/, ''), doc_type: 'outro', ...preset }} onSubmit={upload} submitLabel="Enviar" />
      <ResourceFormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title="Editar documento" fields={metaFields} initial={edit} onSubmit={(v) => updateMeta.mutateAsync(v)} />
      {node}
    </>
  )
}
