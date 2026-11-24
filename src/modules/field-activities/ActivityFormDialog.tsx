/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { useLookups, toOptions } from '@/hooks/useLookups'
import { buildSchema, FormFields, fromFormValues, toFormValues, type FieldDef } from '@/components/forms/ResourceForm'
import { Dialog } from '@/components/ui/overlay'
import { Button, Input, Select } from '@/components/ui/primitives'
import { toUserMessage } from '@/lib/errors'
import { formatBRL, formatNumber } from '@/lib/format'

export const ACTIVITY_STATUS = [
  { value: 'planejada', label: 'Planejada' }, { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' }, { value: 'cancelada', label: 'Cancelada' },
]

interface InputRow { item_id: string; quantity: string; dose_per_ha: string }

export function ActivityFormDialog({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; defaults?: Record<string, any> }) {
  const { orgId, farms, farmId, can } = useCurrentOrg()
  const lk = useLookups()
  const qc = useQueryClient()
  const [inputs, setInputs] = useState<InputRow[]>([])
  const [usage, setUsage] = useState({ hours: '', fuel_liters: '', fuel_cost: '' })

  const base = useMemo(() => {
    const now = new Date()
    return { status: 'concluida', farm_id: farmId ?? farms[0]?.id, started_at: now.toISOString(), labor_cost: 0, other_cost: 0, ...defaults }
  }, [defaults, farmId, farms])

  // Campos dinâmicos: talhões/safras da propriedade selecionada
  const staticFields = (farm: string | undefined, field: string | undefined): FieldDef[] => {
    const fieldsOfFarm = (lk.fields.data ?? []).filter((f) => f.farm_id === farm)
    const linked = new Set((lk.seasonFields.data ?? []).filter((x) => x.field_id === field).map((x) => x.season_id))
    const seasonsOfFarm = (lk.seasons.data ?? []).filter((s) => s.farm_id === farm && (!field || linked.has(s.id)))
    return [
      { name: 'farm_id', label: 'Propriedade', type: 'select', required: true, options: farms.map((f) => ({ value: f.id, label: f.name })), span: 2 },
      { name: 'field_id', label: 'Talhão', type: 'select', options: toOptions(fieldsOfFarm, (f) => f.name), span: 2, emptyOption: 'Toda a propriedade' },
      { name: 'season_id', label: 'Safra', type: 'select', options: toOptions(seasonsOfFarm, (s) => s.name), span: 2, hint: field ? 'Somente safras às quais o talhão está vinculado' : undefined },
      { name: 'activity_type_id', label: 'Tipo de atividade', type: 'select', required: true, options: toOptions(lk.activityTypes.data, (t) => t.name), span: 2 },
      { name: 'title', label: 'Descrição curta', type: 'text', maxLength: 160, span: 2, placeholder: 'Ex.: Aplicação de fungicida' },
      { name: 'status', label: 'Situação', type: 'select', required: true, options: ACTIVITY_STATUS, span: 2 },
      { name: 'started_at', label: 'Início', type: 'datetime', required: true, span: 2 },
      { name: 'ended_at', label: 'Término', type: 'datetime', span: 2 },
      { name: 'area_worked_ha', label: 'Área trabalhada', type: 'number', min: 0, suffix: 'ha', span: 2 },
      { name: 'responsible_employee_id', label: 'Responsável', type: 'select', options: toOptions(lk.employees.data, (e) => e.full_name), span: 2 },
      { name: 'team_id', label: 'Equipe', type: 'select', options: toOptions(lk.teams.data, (t) => t.name), span: 2 },
      { name: 'equipment_id', label: 'Máquina / equipamento', type: 'select', options: toOptions(lk.equipment.data, (e) => e.name), span: 2 },
      { name: 'labor_cost', label: 'Custo de mão de obra', type: 'money', min: 0, span: 2 },
      { name: 'other_cost', label: 'Outros custos', type: 'money', min: 0, span: 2, hint: 'Serviços, frete etc.' },
      { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 4000, span: 3 },
    ]
  }

  const schemaFields = staticFields(undefined, undefined)
  const schema = useMemo(() => buildSchema(schemaFields), [schemaFields.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const form = useForm<any>({ resolver: zodResolver(schema as any), defaultValues: toFormValues(schemaFields, base) })
  const farm = useWatch({ control: form.control, name: 'farm_id' })
  const field = useWatch({ control: form.control, name: 'field_id' })
  const status = useWatch({ control: form.control, name: 'status' })
  const equipment = useWatch({ control: form.control, name: 'equipment_id' })
  const area = useWatch({ control: form.control, name: 'area_worked_ha' })
  const fields = staticFields(farm, field)

  useEffect(() => {
    if (open) { form.reset(toFormValues(schemaFields, base)); setInputs([]); setUsage({ hours: '', fuel_liters: '', fuel_cost: '' }) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const itemsById = new Map((lk.items.data ?? []).map((i) => [i.id, i]))
  const parse = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\./g, '').replace(',', '.')))
  const areaNum = typeof area === 'string' ? parse(area) : Number(area) || null
  const estInputCost = inputs.reduce((s, r) => s + (parse(r.quantity) ?? 0) * Number(itemsById.get(r.item_id)?.average_cost ?? 0), 0)
  const inputsAllowed = status === 'em_andamento' || status === 'concluida'

  const submit = form.handleSubmit(async (raw) => {
    const v = fromFormValues(schemaFields, raw)
    const rows = inputs.filter((r) => r.item_id || r.quantity)
    for (const r of rows) {
      const q = parse(r.quantity)
      if (!r.item_id || !q || q <= 0) { toast.error('Preencha item e quantidade (> 0) em todos os insumos'); return }
      const it = itemsById.get(r.item_id)
      if (it && q > Number(it.current_quantity)) { toast.error(`Saldo insuficiente de ${it.name}: disponível ${formatNumber(it.current_quantity)} ${it.unit}`); return }
    }
    if (rows.length && !inputsAllowed) { toast.error('Insumos só podem ser lançados em atividades em andamento ou concluídas'); return }
    if (v.ended_at && v.started_at && v.ended_at < v.started_at) { toast.error('O término não pode ser anterior ao início'); return }
    const { error } = await supabase.rpc('register_activity', {
      p_activity: { ...v, organization_id: orgId },
      p_inputs: rows.map((r) => ({ item_id: r.item_id, quantity: parse(r.quantity), dose_per_ha: parse(r.dose_per_ha) })),
      p_usage: v.equipment_id ? { hours: parse(usage.hours), fuel_liters: parse(usage.fuel_liters), fuel_cost: parse(usage.fuel_cost) } : undefined,
    })
    if (error) { toast.error(toUserMessage(error)); return }
    toast.success('Atividade registrada')
    ;['activities', 'lk-items', 'inventory', 'field-activities', 'season-acts', 'dashboard', 'equipment'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Registrar atividade" size="xl"
      description="Insumos lançados geram saída de estoque vinculada ao talhão e à safra, e compõem o custo da atividade."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" form="activity-form" loading={form.formState.isSubmitting}>Salvar atividade</Button></>}>
      <form id="activity-form" onSubmit={submit} className="space-y-6" noValidate>
        <FormFields fields={fields} form={form} idPrefix="act" />

        {equipment && (
          <fieldset className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-medium">Uso da máquina</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm">Horas trabalhadas<Input inputMode="decimal" value={usage.hours} onChange={(e) => setUsage({ ...usage, hours: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">Combustível (L)<Input inputMode="decimal" value={usage.fuel_liters} onChange={(e) => setUsage({ ...usage, fuel_liters: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">Custo do combustível (R$)<Input inputMode="decimal" value={usage.fuel_cost} onChange={(e) => setUsage({ ...usage, fuel_cost: e.target.value })} className="mt-1" /></label>
            </div>
            <p className="mt-2 text-xs text-muted">Atualiza o horímetro do equipamento e o histórico de uso.</p>
          </fieldset>
        )}

        {can('inventory') && (
          <fieldset className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-medium">Insumos utilizados</legend>
            {!inputsAllowed && <p className="mb-2 text-xs text-warn">Para lançar insumos, marque a atividade como “em andamento” ou “concluída”.</p>}
            <div className="space-y-2">
              {inputs.map((r, i) => {
                const it = itemsById.get(r.item_id)
                return (
                  <div key={i} className="grid grid-cols-[1fr_110px_110px_40px] items-center gap-2">
                    <Select aria-label="Insumo" value={r.item_id} onChange={(e) => setInputs((a) => a.map((x, j) => (j === i ? { ...x, item_id: e.target.value } : x)))}>
                      <option value="">Selecione o item…</option>
                      {(lk.items.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name} — saldo {formatNumber(x.current_quantity)} {x.unit}</option>)}
                    </Select>
                    <Input aria-label="Quantidade" placeholder={`Qtd ${it?.unit ?? ''}`} inputMode="decimal" value={r.quantity}
                      onChange={(e) => setInputs((a) => a.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                    <Input aria-label="Dose por hectare" placeholder="Dose/ha" inputMode="decimal" value={r.dose_per_ha}
                      onChange={(e) => {
                        const dose = e.target.value
                        const d = parse(dose)
                        setInputs((a) => a.map((x, j) => (j === i ? { ...x, dose_per_ha: dose, quantity: d && areaNum ? String(Math.round(d * areaNum * 1000) / 1000).replace('.', ',') : x.quantity } : x)))
                      }} />
                    <Button variant="ghost" size="icon" aria-label="Remover insumo" onClick={() => setInputs((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={!inputsAllowed} onClick={() => setInputs((a) => [...a, { item_id: '', quantity: '', dose_per_ha: '' }])}><Plus className="h-4 w-4" />Adicionar insumo</Button>
              {inputs.length > 0 && <span className="text-xs text-muted">Custo estimado (custo médio): <strong>{formatBRL(estInputCost)}</strong>{areaNum ? ' · dose × área preenche a quantidade' : ''}</span>}
            </div>
          </fieldset>
        )}
      </form>
    </Dialog>
  )
}
