import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { toUserMessage } from '@/lib/errors'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button, FieldWrap, Input } from '@/components/ui/primitives'
import { Logo, LogoMark } from '@/app/layouts/Logo'

const passwordRule = z.string()
  .min(10, 'Mínimo de 10 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col">
        <Logo />
        <div className="mt-auto max-w-md">
          <p className="text-3xl font-semibold leading-tight">Sua fazenda, seus dados, suas decisões.</p>
          <p className="mt-4 text-sm text-brand-100/80">
            Gestão de propriedades e talhões, safras, diário de campo, financeiro, estoque, máquinas, clima, mercado e marketplace — em um só lugar, com a origem de cada dado sempre visível.
          </p>
        </div>
        <svg className="pointer-events-none absolute -right-24 bottom-0 h-[420px] w-[620px] opacity-[0.10]" viewBox="0 0 600 400" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M0 ${400 - i * 22} C 150 ${360 - i * 24}, 350 ${420 - i * 26}, 600 ${340 - i * 22}`} stroke="white" strokeWidth="1.5" fill="none" />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><span className="inline-flex items-center gap-2"><LogoMark /><span className="text-lg font-semibold text-brand-900">AgroCentral</span></span></div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/** Contas de teste/demonstração podem entrar só com o usuário (ex.: "contateste" → contateste@agrocentral.test) */
const USERNAME_DOMAIN = 'agrocentral.test'
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail ou usuário')
    .transform((v) => (v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`))
    .pipe(z.string().email('E-mail ou usuário inválido')),
  password: z.string().min(1, 'Informe a senha'),
})

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({ resolver: zodResolver(loginSchema) })
  if (session) return <Navigate to={from} replace />
  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) { toast.error(toUserMessage(error)); return }
    navigate(from, { replace: true })
  })
  return (
    <AuthShell title="Entrar" subtitle="Acesse sua conta AgroCentral."
      footer={<>Não tem conta? <Link className="font-medium text-brand-700 underline" to="/cadastro">Criar conta</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FieldWrap label="E-mail ou usuário" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" {...form.register('email')} aria-invalid={!!form.formState.errors.email} />
        </FieldWrap>
        <FieldWrap label="Senha" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} aria-invalid={!!form.formState.errors.password} />
        </FieldWrap>
        <div className="flex justify-end text-sm"><Link className="text-brand-700 underline" to="/recuperar-senha">Esqueci minha senha</Link></div>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Entrar</Button>
      </form>
    </AuthShell>
  )
}

const signupSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: z.string().trim().email('E-mail inválido'),
  password: passwordRule,
  confirm: z.string(),
  terms: z.literal(true, { error: 'É necessário aceitar os termos' }),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' })

export function SignupPage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [sent, setSent] = useState<string | null>(null)
  const invite = params.get('convite')
  const form = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema), defaultValues: { email: params.get('email') ?? '' } })
  if (session) return <Navigate to={invite ? `/convite/${invite}` : '/'} replace />
  const onSubmit = form.handleSubmit(async (v) => {
    const redirect = `${window.location.origin}${invite ? `/convite/${invite}` : '/onboarding'}`
    const { data, error } = await supabase.auth.signUp({
      email: v.email, password: v.password,
      options: { data: { full_name: v.full_name }, emailRedirectTo: redirect },
    })
    if (error) { toast.error(toUserMessage(error)); return }
    if (data.session) return // confirmação de e-mail desativada: sessão já criada
    setSent(v.email)
  })
  if (sent) {
    return (
      <AuthShell title="Confirme seu e-mail" footer={<Link className="text-brand-700 underline" to="/entrar">Voltar para o login</Link>}>
        <div className="flex gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <MailCheck className="h-5 w-5 shrink-0 text-brand-700" />
          <p>Enviamos um link de confirmação para <strong>{sent}</strong>. Abra o e-mail e clique no link para ativar sua conta.</p>
        </div>
      </AuthShell>
    )
  }
  const e = form.formState.errors
  return (
    <AuthShell title="Criar conta" subtitle="Comece a organizar sua propriedade."
      footer={<>Já tem conta? <Link className="font-medium text-brand-700 underline" to="/entrar">Entrar</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FieldWrap label="Nome completo" htmlFor="full_name" error={e.full_name?.message}><Input id="full_name" autoComplete="name" {...form.register('full_name')} /></FieldWrap>
        <FieldWrap label="E-mail" htmlFor="email" error={e.email?.message}><Input id="email" type="email" autoComplete="email" {...form.register('email')} /></FieldWrap>
        <FieldWrap label="Senha" htmlFor="password" error={e.password?.message} hint="Mínimo de 10 caracteres, com letras e números.">
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
        </FieldWrap>
        <FieldWrap label="Confirmar senha" htmlFor="confirm" error={e.confirm?.message}><Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} /></FieldWrap>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" {...form.register('terms')} />
          <span>Li e aceito os <Link to="/termos" target="_blank" className="underline">Termos de uso</Link> e a <Link to="/privacidade" target="_blank" className="underline">Política de privacidade</Link>.</span>
        </label>
        {e.terms && <p className="text-xs text-danger">{e.terms.message}</p>}
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Criar conta</Button>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().trim().email('E-mail inválido') })) })
  const onSubmit = form.handleSubmit(async ({ email }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })
    if (error) { toast.error(toUserMessage(error)); return }
    setSent(true)
  })
  return (
    <AuthShell title="Recuperar acesso" subtitle="Enviaremos um link para redefinir sua senha."
      footer={<Link className="text-brand-700 underline" to="/entrar">Voltar para o login</Link>}>
      {sent ? (
        <div className="flex gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-700" />
          <p>Se existir uma conta com este e-mail, você receberá um link para redefinir a senha em instantes.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FieldWrap label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="email" {...form.register('email')} /></FieldWrap>
          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Enviar link</Button>
        </form>
      )}
    </AuthShell>
  )
}

const resetSchema = z.object({ password: passwordRule, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' })

export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) })
  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) { toast.error(toUserMessage(error)); return }
    toast.success('Senha atualizada')
    navigate('/', { replace: true })
  })
  if (!loading && !session) {
    return (
      <AuthShell title="Link inválido ou expirado" footer={<Link className="text-brand-700 underline" to="/recuperar-senha">Solicitar novo link</Link>}>
        <p className="text-sm text-muted">Abra o link mais recente enviado ao seu e-mail.</p>
      </AuthShell>
    )
  }
  return (
    <AuthShell title="Definir nova senha">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FieldWrap label="Nova senha" htmlFor="password" error={form.formState.errors.password?.message} hint="Mínimo de 10 caracteres, com letras e números.">
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
        </FieldWrap>
        <FieldWrap label="Confirmar senha" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
        </FieldWrap>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Salvar nova senha</Button>
      </form>
    </AuthShell>
  )
}
