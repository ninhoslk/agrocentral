import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/primitives'

/** Atualização do app instalado (PWA): pede confirmação antes de recarregar. */
export function PwaPrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[3000] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-brand-950 px-4 py-3 text-sm text-white shadow-lg">
      Nova versão disponível.
      <Button size="sm" variant="secondary" onClick={() => void updateServiceWorker(true)}>Atualizar</Button>
      <button type="button" className="text-brand-100/80 underline" onClick={() => setNeedRefresh(false)}>Depois</button>
    </div>
  )
}
