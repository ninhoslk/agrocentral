import type { BadgeTone } from '@/components/ui/primitives'

export const SEASON_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  planejada: { label: 'Planejada', tone: 'blue' },
  em_andamento: { label: 'Em andamento', tone: 'green' },
  colhida: { label: 'Colhida', tone: 'yellow' },
  encerrada: { label: 'Encerrada', tone: 'neutral' },
  cancelada: { label: 'Cancelada', tone: 'red' },
}

/** Transições válidas de status da safra (serviço de domínio) */
export const SEASON_TRANSITIONS: Record<string, string[]> = {
  planejada: ['em_andamento', 'cancelada'],
  em_andamento: ['colhida', 'cancelada'],
  colhida: ['encerrada', 'em_andamento'],
  encerrada: ['colhida'],
  cancelada: ['planejada'],
}

export const HARVEST_UNITS = [
  { value: 'sc', label: 'Sacas (sc)' }, { value: 'kg', label: 'Quilos (kg)' }, { value: 't', label: 'Toneladas (t)' }, { value: '@', label: 'Arrobas (@ 15 kg)' },
]

export const DESTINATIONS = [
  { value: 'armazem_proprio', label: 'Armazém próprio' }, { value: 'cooperativa', label: 'Cooperativa' }, { value: 'venda_direta', label: 'Venda direta' },
  { value: 'trading', label: 'Trading' }, { value: 'consumo', label: 'Consumo próprio' }, { value: 'outro', label: 'Outro' },
]
