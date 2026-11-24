import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Shield } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { unwrap, useAppMutation } from '@/services/supabase/query'
import { PageHeader } from '@/components/ui/layout'
import { Badge, Button } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { EmptyState } from '@/components/feedback/states'
import { formatDateTime } from '@/lib/format'

interface Report { id: string; reason: string; details: string | null; status: string; created_at: string; listing_id: string; listings: { title: string; moderation_status: string; seller_name: string } | null }

export function ModerationPage() {
  const admin = useQuery({ queryKey: ['platform-admin-check'], queryFn: async () => { const { data } = await supabase.from('platform_admins').select('user_id').maybeSingle(); return !!data } })
  const q = useQuery({
    queryKey: ['moderation'], enabled: admin.data === true,
    queryFn: () => unwrap(supabase.from('listing_reports').select('*, listings(title, moderation_status, seller_name)').eq('status', 'aberta').order('created_at')) as unknown as Promise<Report[]>,
  })
  const decide = useAppMutation(async ({ listing, decision }: { listing: string; decision: 'ok' | 'removido' }) =>
    unwrap(supabase.rpc('moderate_listing', { p_listing: listing, p_decision: decision, p_note: decision === 'removido' ? 'Removido pela moderação após denúncia' : undefined })),
  { invalidate: [['moderation']], success: 'Decisão registrada' })

  if (admin.isLoading) return null
  if (!admin.data) return <EmptyState icon={<Shield className="h-6 w-6" />} title="Acesso restrito" description="Somente a equipe de moderação da plataforma acessa esta área." />
  const cols: Column<Report>[] = [
    { key: 'at', header: 'Recebida', value: (r) => r.created_at, cell: (r) => formatDateTime(r.created_at) },
    { key: 'listing', header: 'Anúncio', primary: true, value: (r) => r.listings?.title, cell: (r) => <Link className="font-medium underline" to={`/marketplace/anuncio/${r.listing_id}`}>{r.listings?.title}</Link> },
    { key: 'seller', header: 'Anunciante', value: (r) => r.listings?.seller_name, cell: (r) => r.listings?.seller_name },
    { key: 'reason', header: 'Motivo', value: (r) => r.reason, cell: (r) => <span><Badge>{r.reason}</Badge> <span className="text-xs text-muted">{r.details}</span></span> },
    { key: 'mod', header: 'Situação', value: (r) => r.listings?.moderation_status, cell: (r) => <Badge tone={r.listings?.moderation_status === 'ok' ? 'green' : 'yellow'}>{r.listings?.moderation_status}</Badge> },
    { key: 'act', header: '', align: 'right', cell: (r) => <span className="inline-flex gap-1"><Button size="sm" variant="outline" onClick={() => decide.mutate({ listing: r.listing_id, decision: 'ok' })}>Manter</Button><Button size="sm" variant="danger" onClick={() => decide.mutate({ listing: r.listing_id, decision: 'removido' })}>Remover</Button></span> },
  ]
  return (
    <>
      <PageHeader title="Moderação do marketplace" description="Denúncias abertas. Três denúncias ocultam o anúncio automaticamente até a decisão." />
      <DataTable rows={q.data} columns={cols} loading={q.isLoading} error={q.error} empty={<EmptyState title="Nenhuma denúncia aberta" />} />
    </>
  )
}
