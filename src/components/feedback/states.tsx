import { AlertTriangle, CloudOff, Database, FileQuestion, FlaskConical, Hand, RefreshCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatDateTime, relativeTime } from '@/lib/format'
import { toUserMessage } from '@/lib/errors'
import { Badge, Button, Skeleton } from '@/components/ui/primitives'

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-700">{icon ?? <FileQuestion className="h-6 w-6" />}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-3 rounded-full bg-red-50 p-3 text-danger">{offline ? <WifiOff className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}</div>
      <h3 className="text-sm font-semibold">{offline ? 'Sem conexão' : 'Não foi possível carregar'}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{toUserMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  )
}

/**
 * Estado/origem de um dado, conforme o documento-base:
 * real conectado, manual, demonstrativo, desatualizado ou indisponível.
 */
export type DataState = 'real' | 'manual' | 'demo' | 'stale' | 'unavailable'

const STATE_META: Record<DataState, { label: string; tone: 'green' | 'blue' | 'orange' | 'yellow' | 'red'; icon: ReactNode }> = {
  real: { label: 'Dado real', tone: 'green', icon: <Database className="h-3 w-3" /> },
  manual: { label: 'Informado manualmente', tone: 'blue', icon: <Hand className="h-3 w-3" /> },
  demo: { label: 'DADO DEMONSTRATIVO', tone: 'orange', icon: <FlaskConical className="h-3 w-3" /> },
  stale: { label: 'Desatualizado', tone: 'yellow', icon: <AlertTriangle className="h-3 w-3" /> },
  unavailable: { label: 'Indisponível', tone: 'red', icon: <CloudOff className="h-3 w-3" /> },
}

export function DataStateBadge({ state, className }: { state: DataState; className?: string }) {
  const m = STATE_META[state]
  return <Badge tone={m.tone} className={className}>{m.icon}{m.label}</Badge>
}

export function DemoBadge({ show = true }: { show?: boolean | null }) {
  if (!show) return null
  return <DataStateBadge state="demo" />
}

/** Linha de rastreabilidade: fonte, horário, unidade e status — sempre perto do dado. */
export function SourceLine({ source, sourceUrl, fetchedAt, observedAt, unit, state, extra, className }: {
  source: string; sourceUrl?: string | null; fetchedAt?: string | null; observedAt?: string | null
  unit?: string | null; state: DataState; extra?: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted', className)}>
      <DataStateBadge state={state} />
      <span>
        Fonte:{' '}
        {sourceUrl ? <a className="underline hover:text-ink" href={sourceUrl} target="_blank" rel="noreferrer noopener">{source}</a> : source}
      </span>
      {observedAt && <span>Referência: {formatDateTime(observedAt)}</span>}
      {fetchedAt && <span title={formatDateTime(fetchedAt)}>Atualizado {relativeTime(fetchedAt)}</span>}
      {unit && <span>Unidade: {unit}</span>}
      {extra}
    </div>
  )
}
