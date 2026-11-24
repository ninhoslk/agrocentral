import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null
  return (
    <nav aria-label="Navegação estrutural" className="mb-1 hidden flex-wrap items-center gap-1 text-xs text-muted sm:flex">
      {items.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
          {c.to ? <Link to={c.to} className="hover:text-ink hover:underline">{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function PageHeader({ title, description, actions, crumbs, badge }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: Crumb[]; badge?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
      <div className="min-w-0">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold leading-tight text-ink sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-3xl text-[13px] leading-snug text-muted max-sm:line-clamp-2 sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto max-sm:[&>button:not([aria-label])]:flex-1">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'default', className, footer }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn'; className?: string; footer?: ReactNode
}) {
  const toneCls = { default: 'text-ink', good: 'text-ok', bad: 'text-danger', warn: 'text-warn' }[tone]
  return (
    <div className={cn('card flex min-w-0 flex-col gap-0.5 p-3 sm:gap-1 sm:p-4', className)}>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        <span>{label}</span>
        {icon && <span className="text-brand-600">{icon}</span>}
      </div>
      <div className={cn('truncate text-lg font-semibold tabular sm:text-2xl', toneCls)}>{value}</div>
      {hint && <div className="line-clamp-2 text-xs text-muted">{hint}</div>}
      {footer}
    </div>
  )
}

export function Section({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function KeyValue({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
