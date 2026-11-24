import { describe, expect, it } from 'vitest'
import { maintenanceState } from './config'

const base = { hour_meter: 1000, maintenance_interval_hours: 250, maintenance_interval_days: null, last_maintenance_hours: 800, last_maintenance_date: '2026-11-01' }

describe('estado de manutenção', () => {
  it('em dia por horas', () => {
    expect(maintenanceState(base, '2026-11-24').label).toBe('Em dia')
  })
  it('próxima quando a 10% do intervalo', () => {
    expect(maintenanceState({ ...base, hour_meter: 1030 }, '2026-11-24').label).toBe('Próxima')
  })
  it('vencida por horas', () => {
    const s = maintenanceState({ ...base, hour_meter: 1060 }, '2026-11-24')
    expect(s.label).toBe('Vencida')
    expect(s.nextHours).toBe(1050)
  })
  it('vencida por data', () => {
    expect(maintenanceState({ ...base, maintenance_interval_hours: null, maintenance_interval_days: 10 }, '2026-11-24').label).toBe('Vencida')
  })
  it('sem plano', () => {
    expect(maintenanceState({ ...base, maintenance_interval_hours: null }).label).toBe('Sem plano')
  })
})
