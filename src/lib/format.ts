const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const nf = (d = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d })

export function formatBRL(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? brl.format(n) : '—'
}

export function formatNumber(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? nf(digits).format(n) : '—'
}

export function formatArea(v: number | string | null | undefined): string {
  const s = formatNumber(v, 2)
  return s === '—' ? s : `${s} ha`
}

export function formatPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${nf(digits).format(v)}%`
}

/** Datas "YYYY-MM-DD" são tratadas como data local (sem deslocamento de fuso). */
export function parseDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(v: string | Date | null | undefined): string {
  const d = parseDate(v)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}

export function formatDateTime(v: string | Date | null | undefined): string {
  const d = parseDate(v)
  return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

export function relativeTime(v: string | Date | null | undefined): string {
  const d = parseDate(v)
  if (!d) return '—'
  const diff = (Date.now() - d.getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(-Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(-Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(-Math.round(diff / 3600), 'hour')
  return rtf.format(-Math.round(diff / 86400), 'day')
}

/** Data local no formato YYYY-MM-DD (para inputs type=date). */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d)
  n.setDate(n.getDate() + days)
  return n
}
