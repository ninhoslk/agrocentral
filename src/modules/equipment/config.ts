import type { FieldDef } from '@/components/forms/ResourceForm'
import { toISODate } from '@/lib/format'

export const EQUIP_KINDS = [
  { value: 'trator', label: 'Trator' }, { value: 'colheitadeira', label: 'Colheitadeira' }, { value: 'pulverizador', label: 'Pulverizador' },
  { value: 'plantadeira', label: 'Plantadeira' }, { value: 'implemento', label: 'Implemento' }, { value: 'caminhao', label: 'Caminhão' },
  { value: 'caminhonete', label: 'Caminhonete' }, { value: 'veiculo', label: 'Veículo' }, { value: 'irrigacao', label: 'Sistema de irrigação' }, { value: 'outro', label: 'Outro' },
]
export const EQUIP_STATUS = {
  ativo: { label: 'Ativo', tone: 'green' }, em_manutencao: { label: 'Em manutenção', tone: 'yellow' },
  inativo: { label: 'Inativo', tone: 'neutral' }, vendido: { label: 'Vendido', tone: 'neutral' },
} as const

export const equipmentFields = (farms: { id: string; name: string }[]): FieldDef[] => [
  { name: 'name', label: 'Nome / identificação', type: 'text', required: true, maxLength: 120, span: 2 },
  { name: 'kind', label: 'Tipo', type: 'select', required: true, options: EQUIP_KINDS, span: 1 },
  { name: 'brand', label: 'Marca', type: 'text', maxLength: 60, span: 1 },
  { name: 'model', label: 'Modelo', type: 'text', maxLength: 60, span: 1 },
  { name: 'year', label: 'Ano', type: 'number', min: 1900, max: 2100, span: 1 },
  { name: 'identifier', label: 'Código interno', type: 'text', maxLength: 40, span: 1 },
  { name: 'serial_number', label: 'Nº de série / chassi', type: 'text', maxLength: 60, span: 1 },
  { name: 'plate', label: 'Placa', type: 'text', maxLength: 10, span: 1 },
  { name: 'farm_id', label: 'Propriedade', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), emptyOption: 'Compartilhado', span: 1 },
  { name: 'status', label: 'Situação', type: 'select', required: true, options: Object.entries(EQUIP_STATUS).map(([value, s]) => ({ value, label: s.label })), span: 1 },
  { name: 'fuel_type', label: 'Combustível', type: 'select', options: [{ value: 'diesel', label: 'Diesel' }, { value: 'gasolina', label: 'Gasolina' }, { value: 'etanol', label: 'Etanol' }, { value: 'eletrico', label: 'Elétrico' }, { value: 'nenhum', label: 'Nenhum' }], span: 1 },
  { name: 'hour_meter', label: 'Horímetro atual', type: 'number', min: 0, suffix: 'h', span: 1 },
  { name: 'odometer_km', label: 'Hodômetro', type: 'number', min: 0, suffix: 'km', span: 1 },
  { name: 'maintenance_interval_hours', label: 'Revisão a cada', type: 'number', min: 1, suffix: 'h', span: 1 },
  { name: 'maintenance_interval_days', label: 'ou a cada', type: 'number', min: 1, suffix: 'dias', span: 1 },
  { name: 'acquisition_date', label: 'Data de aquisição', type: 'date', span: 1 },
  { name: 'acquisition_value', label: 'Valor de aquisição', type: 'money', min: 0, span: 1 },
  { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 2000, span: 3 },
]

export interface MaintenanceState { label: string; tone: 'green' | 'yellow' | 'red' | 'neutral'; nextHours: number | null; nextDate: string | null }

/** Situação da manutenção preventiva por horas ou por data (a que vencer primeiro). */
export function maintenanceState(e: {
  hour_meter: number | string; maintenance_interval_hours: number | string | null; maintenance_interval_days: number | null
  last_maintenance_hours: number | string | null; last_maintenance_date: string | null; acquisition_date?: string | null; created_at?: string
}, today = toISODate()): MaintenanceState {
  const hm = Number(e.hour_meter)
  const nextHours = e.maintenance_interval_hours ? Number(e.last_maintenance_hours ?? 0) + Number(e.maintenance_interval_hours) : null
  const base = e.last_maintenance_date ?? e.acquisition_date ?? e.created_at?.slice(0, 10) ?? null
  let nextDate: string | null = null
  if (e.maintenance_interval_days && base) {
    const d = new Date(`${base}T12:00:00`)
    d.setDate(d.getDate() + e.maintenance_interval_days)
    nextDate = toISODate(d)
  }
  if (nextHours === null && nextDate === null) return { label: 'Sem plano', tone: 'neutral', nextHours, nextDate }
  const overdue = (nextHours !== null && hm >= nextHours) || (nextDate !== null && nextDate < today)
  if (overdue) return { label: 'Vencida', tone: 'red', nextHours, nextDate }
  const soonDate = new Date(`${today}T12:00:00`); soonDate.setDate(soonDate.getDate() + 7)
  const soon = (nextHours !== null && hm >= nextHours - Number(e.maintenance_interval_hours) * 0.1) || (nextDate !== null && nextDate <= toISODate(soonDate))
  if (soon) return { label: 'Próxima', tone: 'yellow', nextHours, nextDate }
  return { label: 'Em dia', tone: 'green', nextHours, nextDate }
}
