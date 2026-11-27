import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation, useRouteError } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOrg } from '@/app/providers/OrgProvider'
import { AppLayout } from '@/app/layouts/AppLayout'
import { EmptyState, ErrorState } from '@/components/feedback/states'
import { Spinner } from '@/components/ui/primitives'
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from '@/modules/auth/AuthPages'
import { OnboardingPage } from '@/modules/auth/OnboardingPage'
import { InvitePage } from '@/modules/auth/InvitePage'
import { PrivacyPage, TermsPage } from '@/modules/legal/LegalPages'

function lz<M>(loader: () => Promise<M>, name: keyof M) {
  return lazy(() => loader().then((m) => ({ default: m[name] as unknown as ComponentType })))
}

const DashboardPage = lz(() => import('@/modules/dashboard/DashboardPage'), 'DashboardPage')
const NotificationsPage = lz(() => import('@/modules/notifications/NotificationsPage'), 'NotificationsPage')
const WeatherPage = lz(() => import('@/modules/weather/WeatherPage'), 'WeatherPage')
const MarketPage = lz(() => import('@/modules/market/MarketPage'), 'MarketPage')
const FarmsPage = lz(() => import('@/modules/farms/FarmsPage'), 'FarmsPage')
const FarmDetailPage = lz(() => import('@/modules/farms/FarmDetailPage'), 'FarmDetailPage')
const FarmMapPage = lz(() => import('@/modules/farms/FarmMapPage'), 'FarmMapPage')
const FieldsPage = lz(() => import('@/modules/fields/FieldsPage'), 'FieldsPage')
const FieldDetailPage = lz(() => import('@/modules/fields/FieldDetailPage'), 'FieldDetailPage')
const SeasonsPage = lz(() => import('@/modules/seasons/SeasonsPage'), 'SeasonsPage')
const SeasonDetailPage = lz(() => import('@/modules/seasons/SeasonDetailPage'), 'SeasonDetailPage')
const ActivitiesPage = lz(() => import('@/modules/field-activities/ActivitiesPage'), 'ActivitiesPage')
const TasksPage = lz(() => import('@/modules/tasks/TasksPage'), 'TasksPage')
const TeamPage = lz(() => import('@/modules/team/TeamPage'), 'TeamPage')
const FinancePage = lz(() => import('@/modules/finance/FinancePage'), 'FinancePage')
const BudgetPage = lz(() => import('@/modules/budget/BudgetPage'), 'BudgetPage')
const InventoryPage = lz(() => import('@/modules/inventory/InventoryPage'), 'InventoryPage')
const EquipmentPage = lz(() => import('@/modules/equipment/EquipmentPage'), 'EquipmentPage')
const EquipmentDetailPage = lz(() => import('@/modules/equipment/EquipmentDetailPage'), 'EquipmentDetailPage')
const DocumentsPage = lz(() => import('@/modules/documents/DocumentsPage'), 'DocumentsPage')
const CalculatorsPage = lz(() => import('@/modules/calculators/CalculatorsPage'), 'CalculatorsPage')
const ReportsPage = lz(() => import('@/modules/reports/ReportsPage'), 'ReportsPage')
const SatellitePage = lz(() => import('@/modules/tech/TechPages'), 'SatellitePage')
const AgroIAPage = lz(() => import('@/modules/tech/AgroIAPage'), 'AgroIAPage')
const IntegrationsPage = lz(() => import('@/modules/tech/TechPages'), 'IntegrationsPage')
const MarketplacePage = lz(() => import('@/modules/marketplace/MarketplacePage'), 'MarketplacePage')
const ListingPage = lz(() => import('@/modules/marketplace/ListingPage'), 'ListingPage')
const PublicListingPage = lz(() => import('@/modules/marketplace/ListingPage'), 'PublicListingPage')
const ListingFormPage = lz(() => import('@/modules/marketplace/ListingFormPage'), 'ListingFormPage')
const MyListingsPage = lz(() => import('@/modules/marketplace/MyListingsPage'), 'MyListingsPage')
const FavoritesPage = lz(() => import('@/modules/marketplace/MyListingsPage'), 'FavoritesPage')
const MessagesPage = lz(() => import('@/modules/marketplace/MessagesPage'), 'MessagesPage')
const ModerationPage = lz(() => import('@/modules/marketplace/ModerationPage'), 'ModerationPage')
const SettingsPage = lz(() => import('@/modules/settings/SettingsPage'), 'SettingsPage')

function PageFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

function RequireAuth() {
  const { session, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!session) return <Navigate to="/entrar" replace state={{ from: loc.pathname + loc.search }} />
  return <Outlet />
}

function RequireOrg() {
  const { loading, org } = useOrg()
  if (loading) return <div className="flex min-h-dvh items-center justify-center"><Spinner label="Carregando sua conta" /></div>
  if (!org) return <Navigate to="/onboarding" replace />
  return <AppLayout />
}

/** Bloqueia a rota se o módulo estiver desativado ou sem permissão de visualização. */
function ModuleGuard({ module, children }: { module: string; children: ReactNode }) {
  const { can, moduleEnabled } = useOrg()
  if (!moduleEnabled(module)) {
    return <EmptyState icon={<Lock className="h-6 w-6" />} title="Módulo desativado" description="Este módulo está desativado para a sua organização. Um administrador pode ativá-lo em Configurações → Organização." />
  }
  if (module !== 'marketplace' && !can(module, 'view')) {
    return <EmptyState icon={<Lock className="h-6 w-6" />} title="Sem permissão" description="Seu papel não tem acesso a este módulo. Fale com o administrador da organização." />
  }
  return <>{children}</>
}

function RouteError() {
  const err = useRouteError()
  return <div className="p-8"><ErrorState error={err} onRetry={() => window.location.reload()} /></div>
}

const m = (module: string, el: ReactNode) => <S><ModuleGuard module={module}>{el}</ModuleGuard></S>

export const router = createBrowserRouter([
  { path: '/entrar', element: <LoginPage /> },
  { path: '/cadastro', element: <SignupPage /> },
  { path: '/recuperar-senha', element: <ForgotPasswordPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/termos', element: <TermsPage /> },
  { path: '/privacidade', element: <PrivacyPage /> },
  { path: '/anuncio/:id', element: <S><PublicListingPage /></S> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '/convite/:token', element: <InvitePage /> },
      {
        element: <RequireOrg />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <S><DashboardPage /></S> },
          { path: 'notificacoes', element: <S><NotificationsPage /></S> },
          { path: 'clima', element: m('weather', <WeatherPage />) },
          { path: 'mercado', element: m('market', <MarketPage />) },
          { path: 'propriedades', element: m('farms', <FarmsPage />) },
          { path: 'propriedades/:id', element: m('farms', <FarmDetailPage />) },
          { path: 'mapa', element: m('farms', <FarmMapPage />) },
          { path: 'talhoes', element: m('fields', <FieldsPage />) },
          { path: 'talhoes/:id', element: m('fields', <FieldDetailPage />) },
          { path: 'safras', element: m('seasons', <SeasonsPage />) },
          { path: 'safras/:id', element: m('seasons', <SeasonDetailPage />) },
          { path: 'diario', element: m('activities', <ActivitiesPage />) },
          { path: 'tarefas', element: m('tasks', <TasksPage />) },
          { path: 'equipe', element: m('team', <TeamPage />) },
          { path: 'financeiro', element: m('finance', <FinancePage />) },
          { path: 'orcamento', element: m('budget', <BudgetPage />) },
          { path: 'estoque', element: m('inventory', <InventoryPage />) },
          { path: 'maquinas', element: m('equipment', <EquipmentPage />) },
          { path: 'maquinas/:id', element: m('equipment', <EquipmentDetailPage />) },
          { path: 'documentos', element: m('documents', <DocumentsPage />) },
          { path: 'calculadoras', element: <S><CalculatorsPage /></S> },
          { path: 'relatorios', element: m('reports', <ReportsPage />) },
          { path: 'satelite', element: <S><SatellitePage /></S> },
          { path: 'agroia', element: <S><AgroIAPage /></S> },
          { path: 'integracoes', element: <S><IntegrationsPage /></S> },
          { path: 'marketplace', element: m('marketplace', <MarketplacePage />) },
          { path: 'marketplace/anuncio/:id', element: m('marketplace', <ListingPage />) },
          { path: 'marketplace/novo', element: m('marketplace', <ListingFormPage />) },
          { path: 'marketplace/editar/:id', element: m('marketplace', <ListingFormPage />) },
          { path: 'marketplace/meus-anuncios', element: m('marketplace', <MyListingsPage />) },
          { path: 'marketplace/favoritos', element: m('marketplace', <FavoritesPage />) },
          { path: 'marketplace/mensagens', element: m('marketplace', <MessagesPage />) },
          { path: 'marketplace/mensagens/:id', element: m('marketplace', <MessagesPage />) },
          { path: 'marketplace/moderacao', element: <S><ModerationPage /></S> },
          { path: 'configuracoes', element: <Navigate to="/configuracoes/perfil" replace /> },
          { path: 'configuracoes/:tab', element: <S><SettingsPage /></S> },
          { path: '*', element: <EmptyState title="Página não encontrada" description="O endereço acessado não existe." /> },
        ],
      },
    ],
  },
])
