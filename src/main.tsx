import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import '@/styles/index.css'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { OrgProvider } from '@/app/providers/OrgProvider'
import { router } from '@/app/router/routes'
import { PwaPrompt } from '@/app/providers/PwaPrompt'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => {
        const code = (err as { code?: string; status?: number })?.code
        if (code && ['42501', 'PGRST116', 'PGRST301'].includes(code)) return false
        return count < 2
      },
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrgProvider>
          <RouterProvider router={router} />
          <PwaPrompt />
        </OrgProvider>
      </AuthProvider>
      <Toaster richColors position="top-center" closeButton />
    </QueryClientProvider>
  </StrictMode>,
)
