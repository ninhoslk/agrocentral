import type { Dimension } from '@/lib/budget'

export const STATUS = {
  previsto: { label: 'Previsto', tone: 'blue' },
  aprovado: { label: 'Aprovado', tone: 'brand' },
  realizado: { label: 'Realizado', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
} as const
export const EXPENSE_TYPES = [
  { value: 'custeio', label: 'Custeio' }, { value: 'investimento', label: 'Investimento' },
  { value: 'financiamento', label: 'Financiamento / juros' }, { value: 'administrativo', label: 'Administrativo' },
]
export const UNITS = ['un', 'kg', 't', 'sc', '@', 'L', 'mL', 'ha', 'h', 'dia', 'mês', 'km', 'kWh', 'm³', 'saco', 'cx', 'dose', 'serviço']
export const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'category', label: 'Categoria' }, { value: 'subcategory', label: 'Subcategoria' }, { value: 'season', label: 'Safra' },
  { value: 'crop', label: 'Cultura' }, { value: 'field', label: 'Talhão' }, { value: 'farm', label: 'Propriedade' },
  { value: 'activity', label: 'Atividade' }, { value: 'expense_type', label: 'Tipo de despesa' }, { value: 'month', label: 'Mês' },
]
