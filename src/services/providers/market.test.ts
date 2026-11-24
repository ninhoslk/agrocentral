import { describe, expect, it } from 'vitest'
import { businessDaysSince, quoteState, variation } from './market'

describe('mercado', () => {
  it('conta dias úteis', () => {
    // sexta 20/11/2026 -> terça 24/11/2026 = 2 dias úteis (seg, ter)
    expect(businessDaysSince('2026-11-20T16:00:00Z', new Date('2026-11-24T12:00:00'))).toBe(2)
  })
  it('classifica estado da cotação', () => {
    const now = new Date('2026-11-24T12:00:00')
    expect(quoteState({ status: 'oficial', observed_at: '2026-11-23T16:00:00Z' }, now)).toBe('real')
    expect(quoteState({ status: 'oficial', observed_at: '2026-11-10T16:00:00Z' }, now)).toBe('stale')
    expect(quoteState({ status: 'demonstrativo', observed_at: '2026-11-24T16:00:00Z' }, now)).toBe('demo')
    expect(quoteState({ status: 'manual', observed_at: '2026-11-24T16:00:00Z' }, now)).toBe('manual')
  })
  it('calcula variação diária e semanal', () => {
    const s = [
      { value: 5.0, observed_at: '2026-11-16T16:00:00Z' },
      { value: 5.2, observed_at: '2026-11-20T16:00:00Z' },
      { value: 5.46, observed_at: '2026-11-23T16:00:00Z' },
    ]
    expect(variation(s)).toBeCloseTo(5, 5)
    expect(variation(s, 7)).toBeCloseTo(9.2, 5)
    expect(variation([s[0]])).toBeNull()
  })
})
