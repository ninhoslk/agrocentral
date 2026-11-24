/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { toUserMessage } from '@/lib/errors'
import { Button, Checkbox, FieldWrap, Input, Select, Textarea } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/overlay'

export interface Option { value: string; label: string }

export interface FieldDef {
  name: string
  label: string
  type: 'text' | 'number' | 'money' | 'date' | 'datetime' | 'time' | 'textarea' | 'select' | 'checkbox' | 'email' | 'tel' | 'tags'
  required?: boolean
  options?: Option[]
  min?: number
  max?: number
  step?: number
  maxLength?: number
  placeholder?: string
  hint?: ReactNode
  suffix?: string
  span?: 1 | 2 | 3
  disabled?: boolean
  showIf?: (values: Record<string, any>) => boolean
  emptyOption?: string
}

const toNull = (v: unknown) => (v === '' || v === undefined ? null : v)

/** Constrói o schema Zod a partir das definições — validação no cliente; o banco valida de novo. */
export function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    // Campos desabilitados não são validados nem enviados
    const f = field.disabled ? { ...field, required: false } : field
    let s: z.ZodTypeAny
    switch (f.type) {
      case 'number':
      case 'money': {
        let n = z.number({ error: 'Informe um número válido' })
        if (f.min !== undefined) n = n.min(f.min, `Mínimo ${f.min}`)
        if (f.max !== undefined) n = n.max(f.max, `Máximo ${f.max}`)
        s = z.preprocess((v) => {
          if (v === '' || v === null || v === undefined) return null
          const num = typeof v === 'number' ? v : Number(String(v).replace(/\./g, (m, _i, str) => (str.includes(',') ? '' : m)).replace(',', '.'))
          return Number.isFinite(num) ? num : NaN
        }, f.required ? n : n.nullable())
        break
      }
      case 'checkbox':
        s = z.boolean().default(false)
        break
      case 'email':
        s = z.preprocess(toNull, f.required ? z.string().trim().email('E-mail inválido') : z.string().trim().email('E-mail inválido').nullable())
        break
      case 'tags':
        s = z.preprocess((v) => (Array.isArray(v) ? v : String(v ?? '').split(',').map((t) => t.trim()).filter(Boolean)), z.array(z.string().max(40)).max(20))
        break
      default: {
        let t = z.string().trim()
        if (f.maxLength) t = t.max(f.maxLength, `Máximo de ${f.maxLength} caracteres`)
        if (f.required) t = t.min(1, 'Campo obrigatório')
        s = z.preprocess((v) => (v === null || v === undefined ? '' : v), t).transform((v) => (v === '' ? null : v))
        if (f.required) s = s.refine((v) => v !== null, 'Campo obrigatório')
      }
    }
    shape[f.name] = s
  }
  return z.object(shape)
}

export function FormFields({ fields, form, idPrefix = 'f' }: { fields: FieldDef[]; form: UseFormReturn<any>; idPrefix?: string }) {
  const values = useWatch({ control: form.control })
  const { register, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
      {fields.map((f) => {
        if (f.showIf && !f.showIf(values ?? {})) return null
        const id = `${idPrefix}-${f.name}`
        const err = (errors[f.name]?.message as string | undefined) ?? undefined
        const span = f.span === 3 ? 'sm:col-span-6' : f.span === 1 ? 'sm:col-span-2' : 'sm:col-span-3'
        const common = { id, 'aria-invalid': err ? true : undefined, disabled: f.disabled, ...register(f.name) }
        let control: ReactNode
        switch (f.type) {
          case 'textarea':
            control = <Textarea {...common} placeholder={f.placeholder} maxLength={f.maxLength} />
            break
          case 'select':
            control = (
              <Select {...common}>
                <option value="">{f.emptyOption ?? (f.required ? 'Selecione…' : '—')}</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            )
            break
          case 'checkbox':
            return (
              <div key={f.name} className={cn(span, 'flex items-end pb-2')}>
                <Checkbox label={f.label} {...register(f.name)} disabled={f.disabled} />
              </div>
            )
          default: {
            const type = f.type === 'money' || f.type === 'number' ? 'text' : f.type === 'datetime' ? 'datetime-local' : f.type === 'tags' ? 'text' : f.type
            control = (
              <div className="relative">
                <Input {...common} type={type} inputMode={f.type === 'money' || f.type === 'number' ? 'decimal' : undefined}
                  placeholder={f.placeholder ?? (f.type === 'tags' ? 'separe por vírgula' : undefined)} maxLength={f.maxLength}
                  className={cn(f.suffix && 'pr-14', f.type === 'money' && 'pl-9')} />
                {f.type === 'money' && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>}
                {f.suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{f.suffix}</span>}
              </div>
            )
          }
        }
        return (
          <FieldWrap key={f.name} label={f.label} htmlFor={id} error={err} hint={f.hint} required={f.required} className={span}>
            {control}
          </FieldWrap>
        )
      })}
    </div>
  )
}

/** Normaliza valores vindos do banco para o formulário (null -> '', números -> string pt-BR). */
export function toFormValues(fields: FieldDef[], data?: Record<string, any> | null) {
  const out: Record<string, any> = {}
  for (const f of fields) {
    const v = data?.[f.name]
    if (f.type === 'checkbox') out[f.name] = Boolean(v)
    else if (f.type === 'tags') out[f.name] = Array.isArray(v) ? v.join(', ') : ''
    else if (f.type === 'datetime') out[f.name] = v ? toLocalDateTime(v) : ''
    else if (f.type === 'number' || f.type === 'money') out[f.name] = v === null || v === undefined ? '' : String(v).replace('.', ',')
    else out[f.name] = v ?? ''
  }
  return out
}

function toLocalDateTime(v: string) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Converte datetime-local para ISO com fuso */
export function fromFormValues(fields: FieldDef[], values: Record<string, any>) {
  const out: Record<string, any> = { ...values }
  for (const f of fields) {
    if (f.type === 'datetime' && out[f.name]) out[f.name] = new Date(out[f.name]).toISOString()
    if (f.showIf && !f.showIf(values)) out[f.name] = null
    if (f.disabled) delete out[f.name]
  }
  return out
}

export function ResourceFormDialog({ open, onOpenChange, title, description, fields, initial, defaults, onSubmit, submitLabel = 'Salvar', size = 'lg', extra, refine }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: ReactNode
  fields: FieldDef[]
  initial?: Record<string, any> | null
  defaults?: Record<string, any>
  onSubmit: (values: Record<string, any>) => Promise<unknown>
  submitLabel?: string
  size?: 'md' | 'lg' | 'xl'
  extra?: (form: UseFormReturn<any>) => ReactNode
  refine?: (values: Record<string, any>) => string | null
}) {
  const schema = useMemo(() => buildSchema(fields), [fields])
  const form = useForm<any>({ resolver: zodResolver(schema as any), defaultValues: toFormValues(fields, { ...defaults, ...initial }) })

  useEffect(() => {
    if (open) form.reset(toFormValues(fields, { ...defaults, ...initial }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const submit = form.handleSubmit(async (values) => {
    const err = refine?.(values)
    if (err) { toast.error(err); return }
    try {
      await onSubmit(fromFormValues(fields, values))
      toast.success('Salvo com sucesso')
      onOpenChange(false)
    } catch (e) {
      if (!(e as { __toasted?: boolean })?.__toasted) toast.error(toUserMessage(e))
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancelar</Button>
          <Button type="submit" form="resource-form" loading={form.formState.isSubmitting}>{submitLabel}</Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} noValidate className="space-y-4">
        <FormFields fields={fields} form={form} />
        {extra?.(form)}
      </form>
    </Dialog>
  )
}
