import * as RDialog from '@radix-ui/react-dialog'
import * as RDropdown from '@radix-ui/react-dropdown-menu'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './primitives'

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const w = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[size]
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in" />
        <RDialog.Content
          className={cn(
            'fixed z-[1001] flex max-h-[92dvh] w-full flex-col bg-white shadow-xl focus:outline-none',
            'inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            w,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <RDialog.Title className="text-base font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-sm text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Diálogo'}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar"><X className="h-4 w-4" /></Button>
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 max-sm:[&>button]:flex-1">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirmar', tone = 'danger', onConfirm, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode
  confirmLabel?: string; tone?: 'danger' | 'primary'; onConfirm: () => void | Promise<void>; loading?: boolean
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button variant={tone} onClick={() => onConfirm()} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm text-muted">{description}</div>
    </Dialog>
  )
}

/** Hook para confirmação imperativa simples */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; description?: ReactNode; confirmLabel?: string; resolve: (v: boolean) => void } | null>(null)
  const confirm = (title: string, description?: ReactNode, confirmLabel?: string) =>
    new Promise<boolean>((resolve) => setState({ title, description, confirmLabel, resolve }))
  const node = state ? (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) { state.resolve(false); setState(null) } }}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      onConfirm={() => { state.resolve(true); setState(null) }}
    />
  ) : null
  return { confirm, node }
}

export function Dropdown({ trigger, items, align = 'end' }: {
  trigger: ReactNode
  align?: 'start' | 'end'
  items: ({ label: ReactNode; onSelect: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean } | 'separator')[]
}) {
  return (
    <RDropdown.Root>
      <RDropdown.Trigger asChild>{trigger}</RDropdown.Trigger>
      <RDropdown.Portal>
        <RDropdown.Content align={align} sideOffset={6} className="z-[1100] min-w-[200px] rounded-xl border border-line bg-white p-1 shadow-lg">
          {items.map((it, i) =>
            it === 'separator' ? (
              <RDropdown.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <RDropdown.Item
                key={i}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface',
                  it.danger && 'text-danger',
                )}
              >
                {it.icon}
                {it.label}
              </RDropdown.Item>
            ),
          )}
        </RDropdown.Content>
      </RDropdown.Portal>
    </RDropdown.Root>
  )
}
