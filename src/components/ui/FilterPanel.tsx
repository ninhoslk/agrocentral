import { useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useIsDesktop } from '@/hooks/useMediaQuery'

/**
 * Filtros sempre visíveis no desktop; no celular viram uma linha única "Filtros · resumo"
 * que expande ao toque, para a lista começar no alto da tela.
 */
export function FilterPanel({ children, summary, className, gridClassName }: { children: ReactNode; summary?: string; className?: string; gridClassName?: string }) {
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  if (desktop) return <div className={cn('card mb-4 p-3', gridClassName, className)}>{children}</div>
  return (
    <div className={cn('card mb-3', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm [-webkit-tap-highlight-color:transparent]">
        <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden />
        <span className="font-medium">Filtros</span>
        {summary && <span className="min-w-0 flex-1 truncate text-muted">· {summary}</span>}
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className={cn('border-t border-line p-3', gridClassName)}>{children}</div>}
    </div>
  )
}
