import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900',
  secondary: 'bg-brand-50 text-brand-900 hover:bg-brand-100 border border-brand-100',
  outline: 'border border-line bg-white text-ink hover:bg-surface active:bg-black/5',
  ghost: 'text-ink hover:bg-black/5 active:bg-black/10',
  danger: 'bg-danger text-white hover:bg-red-800',
}
const sizes: Record<Size, string> = {
  // No celular os alvos de toque têm ao menos 40-44px; no desktop voltam ao tamanho compacto
  sm: 'h-10 px-3 text-sm gap-1.5 sm:h-8',
  md: 'h-11 px-4 text-[15px] gap-2 sm:h-10 sm:text-sm',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-11 w-11 justify-center sm:h-9 sm:w-9',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

const fieldBase =
  'w-full rounded-lg border border-line bg-white px-3 text-base text-ink sm:text-sm placeholder:text-muted/70 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-surface disabled:text-muted aria-[invalid=true]:border-danger'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-11 sm:h-10', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-[88px] py-2', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'h-11 pr-8 sm:h-10', className)} {...rest}>
      {children}
    </select>
  )
})

export function Label({ className, ...rest }: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string }) {
  return <label className={cn('text-sm font-medium text-ink', className)} {...rest} />
}

export function FieldWrap({ label, htmlFor, error, hint, required, children, className }: {
  label?: ReactNode; htmlFor?: string; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        </Label>
      )}
      {children}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest} />
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const badgeTones = {
  neutral: 'bg-gray-100 text-gray-700',
  green: 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/20',
  yellow: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  orange: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/20',
  brand: 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/20',
} as const
export type BadgeTone = keyof typeof badgeTones

export function Badge({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium', badgeTones[tone], className)} {...rest} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-black/[0.06]', className)} aria-hidden />
}

export function Spinner({ className, label = 'Carregando' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}…</span>
    </span>
  )
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line accent-brand-700" {...rest} />
      <span>{label}</span>
    </label>
  )
}

export function Tabs<T extends string>({ value, onChange, items, className }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line scrollbar-thin', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === it.value ? 'border-brand-700 text-brand-900' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {it.label}
          {it.count !== undefined && <span className="rounded-full bg-black/5 px-1.5 text-xs tabular">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}
