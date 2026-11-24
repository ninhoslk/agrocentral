import type { FieldDef } from '@/components/forms/ResourceForm'
import { UFS } from '@/services/providers/ibge'

export const TENURE = [
  { value: 'propria', label: 'Própria' }, { value: 'arrendada', label: 'Arrendada' }, { value: 'parceria', label: 'Parceria' },
  { value: 'comodato', label: 'Comodato' }, { value: 'outra', label: 'Outra' },
]

export const POI_KINDS = [
  { value: 'sede', label: 'Sede' }, { value: 'galpao', label: 'Galpão' }, { value: 'silo', label: 'Silo' }, { value: 'poco', label: 'Poço' },
  { value: 'reservatorio', label: 'Reservatório' }, { value: 'estrada', label: 'Estrada' }, { value: 'ponte', label: 'Ponte' },
  { value: 'acesso', label: 'Acesso' }, { value: 'estacao_meteorologica', label: 'Estação meteorológica' }, { value: 'rio', label: 'Rio' },
  { value: 'construcao', label: 'Construção' }, { value: 'outro', label: 'Outro' },
]

export const farmFields: FieldDef[] = [
  { name: 'name', label: 'Nome da propriedade', type: 'text', required: true, maxLength: 120, span: 2 },
  { name: 'code', label: 'Código', type: 'text', maxLength: 20, span: 1 },
  { name: 'state', label: 'UF', type: 'select', options: UFS.map((u) => ({ value: u, label: u })), span: 1 },
  { name: 'city', label: 'Município', type: 'text', maxLength: 120, span: 2 },
  { name: 'address', label: 'Endereço / acesso', type: 'text', maxLength: 240, span: 3 },
  { name: 'latitude', label: 'Latitude (sede)', type: 'number', min: -90, max: 90, span: 1, hint: 'Ex.: -17,7923' },
  { name: 'longitude', label: 'Longitude (sede)', type: 'number', min: -180, max: 180, span: 1, hint: 'Ex.: -50,9192' },
  { name: 'tenure_type', label: 'Tipo de posse', type: 'select', options: TENURE, span: 1 },
  { name: 'total_area_ha', label: 'Área total', type: 'number', min: 0, suffix: 'ha', span: 1 },
  { name: 'productive_area_ha', label: 'Área produtiva', type: 'number', min: 0, suffix: 'ha', span: 1 },
  { name: 'preservation_area_ha', label: 'APP', type: 'number', min: 0, suffix: 'ha', span: 1 },
  { name: 'legal_reserve_ha', label: 'Reserva legal', type: 'number', min: 0, suffix: 'ha', span: 1 },
  { name: 'owner_name', label: 'Proprietário / responsável', type: 'text', maxLength: 120, span: 2 },
  { name: 'car_code', label: 'Código CAR', type: 'text', maxLength: 60, span: 2 },
  { name: 'incra_code', label: 'Código INCRA/CCIR', type: 'text', maxLength: 60, span: 1 },
  { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 2000, span: 3 },
]

export const fieldFormFields: FieldDef[] = [
  { name: 'name', label: 'Nome do talhão', type: 'text', required: true, maxLength: 120, span: 2 },
  { name: 'code', label: 'Código', type: 'text', maxLength: 20, span: 1 },
  { name: 'manual_area_ha', label: 'Área informada', type: 'number', min: 0.0001, suffix: 'ha', span: 1, hint: 'Usada quando não há polígono no mapa' },
  { name: 'soil_type', label: 'Tipo de solo', type: 'text', maxLength: 80, span: 1 },
  { name: 'relief', label: 'Relevo', type: 'select', span: 1, options: [
    { value: 'plano', label: 'Plano' }, { value: 'suave_ondulado', label: 'Suave ondulado' }, { value: 'ondulado', label: 'Ondulado' },
    { value: 'forte_ondulado', label: 'Forte ondulado' }, { value: 'montanhoso', label: 'Montanhoso' }] },
  { name: 'irrigation', label: 'Irrigação', type: 'select', required: true, span: 1, options: [
    { value: 'sequeiro', label: 'Sequeiro' }, { value: 'pivo', label: 'Pivô central' }, { value: 'gotejamento', label: 'Gotejamento' },
    { value: 'aspersao', label: 'Aspersão' }, { value: 'sulco', label: 'Sulco' }, { value: 'outro', label: 'Outro' }] },
  { name: 'color', label: 'Cor no mapa', type: 'text', placeholder: '#22c55e', maxLength: 7, span: 1 },
  { name: 'notes', label: 'Observações', type: 'textarea', maxLength: 2000, span: 3 },
]

export const IRRIGATION_LABEL: Record<string, string> = {
  sequeiro: 'Sequeiro', pivo: 'Pivô central', gotejamento: 'Gotejamento', aspersao: 'Aspersão', sulco: 'Sulco', outro: 'Outro',
}
export const TENURE_LABEL = Object.fromEntries(TENURE.map((t) => [t.value, t.label]))
export const POI_LABEL = Object.fromEntries(POI_KINDS.map((t) => [t.value, t.label]))
