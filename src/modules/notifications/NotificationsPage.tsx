import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Archive, Bell, CheckCheck } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button, Select, Tabs } from '@/components/ui/primitives'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/states'
import { cn } from '@/lib/cn'
import { formatDateTime, relativeTime } from '@/lib/format'

export const CATEGORIES = [
  { value: 'clima', label: 'Clima' }, { value: 'mercado', label: 'Mercado' }, { value: 'financeiro', label: 'Financeiro' }, { value: 'estoque', label: 'Estoque' },
  { value: 'maquinas', label: 'Máquinas' }, { value: 'safras', label: 'Safras' }, { value: 'tarefas', label: 'Tarefas' }, { value: 'marketplace', label: 'Marketplace' },
  { value: 'documentos', label: 'Documentos' }, { value: 'sistema', label: 'Sistema' },
]
const PRIO_TONE = { baixa: 'neutral', media: 'blue', alta: 'yellow', critica: 'red' } as const

export function NotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'nao_lidas' | 'todas' | 'arquivadas'>('nao_lidas')
  const [cat, setCat] = useState('')
  const q = useQuery({
    queryKey: ['notifications', tab, cat],
    queryFn: () => {
      let qb = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(300)
      if (tab === 'arquivadas') qb = qb.not('archived_at', 'is', null)
      else qb = qb.is('archived_at', null)
      if (tab === 'nao_lidas') qb = qb.is('read_at', null)
      if (cat) qb = qb.eq('category', cat)
      return unwrap(qb)
    },
  })
  const inval = [['notifications'], ['notif-unread']]
  const markRead = useAppMutation(async (ids: string[]) => unwrap(supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)), { invalidate: inval })
  const archive = useAppMutation(async (ids: string[]) => unwrap(supabase.from('notifications').update({ archived_at: new Date().toISOString(), read_at: new Date().toISOString() }).in('id', ids)), { invalidate: inval })
  const rows = q.data ?? []
  const unreadIds = rows.filter((n) => !n.read_at).map((n) => n.id)

  return (
    <>
      <PageHeader title="Central de notificações" crumbs={[{ label: 'Visão geral' }, { label: 'Notificações' }]}
        description="Avisos de clima, mercado, financeiro, estoque, máquinas, tarefas, documentos e marketplace. Configure em Configurações → Alertas."
        actions={<>
          <Select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 w-44"><option value="">Todas as categorias</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
          <Button variant="outline" disabled={!unreadIds.length} onClick={() => markRead.mutate(unreadIds)}><CheckCheck className="h-4 w-4" />Marcar todas como lidas</Button>
        </>} />
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'nao_lidas', label: 'Não lidas' }, { value: 'todas', label: 'Todas' }, { value: 'arquivadas', label: 'Arquivadas' }]} />
      <div className="card">
        {q.isLoading ? <LoadingRows /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title={tab === 'nao_lidas' ? 'Tudo em dia' : 'Nenhuma notificação'} description="Novos avisos aparecem aqui em tempo real." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className={cn('flex gap-3 px-4 py-3', !n.read_at && 'bg-brand-50/40')}>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-600')} aria-hidden />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { if (!n.read_at) markRead.mutate([n.id]); if (n.link) navigate(n.link) }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm', !n.read_at && 'font-semibold')}>{n.title}</span>
                    <Badge>{CATEGORIES.find((c) => c.value === n.category)?.label}</Badge>
                    <Badge tone={PRIO_TONE[n.priority as keyof typeof PRIO_TONE]}>{n.priority}</Badge>
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted" title={formatDateTime(n.created_at)}>
                    {relativeTime(n.created_at)}{n.source && ` · fonte: ${n.source}`}{n.read_at && ` · lida ${relativeTime(n.read_at)}`}
                    {n.valid_until && new Date(n.valid_until) < new Date() && ' · expirada'}
                  </p>
                </button>
                {!n.archived_at && <Button variant="ghost" size="icon" aria-label="Arquivar" onClick={() => archive.mutate([n.id])}><Archive className="h-4 w-4" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
