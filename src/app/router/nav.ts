import {
  Banknote, Bell, PiggyBank, BookOpen, Bot, Boxes, Calculator, CloudSun, FileText, Heart, LayoutDashboard, LineChart,
  ListChecks, Map, MapPinned, MessagesSquare, Plug, Radar, ScrollText, Settings, Shield, Sprout, Store, Tractor, Users, Grid3x3, Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** módulo usado para habilitação e permissão de visualização */
  module?: string
  /** rótulo de status (ex.: "em breve") */
  tag?: string
}
export interface NavGroup { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Notificações', to: '/notificacoes', icon: Bell },
      { label: 'Clima', to: '/clima', icon: CloudSun, module: 'weather' },
      { label: 'Mercado agrícola', to: '/mercado', icon: LineChart, module: 'market' },
    ],
  },
  {
    label: 'Minha fazenda',
    items: [
      { label: 'Propriedades', to: '/propriedades', icon: MapPinned, module: 'farms' },
      { label: 'Mapa da fazenda', to: '/mapa', icon: Map, module: 'farms' },
      { label: 'Talhões', to: '/talhoes', icon: Grid3x3, module: 'fields' },
      { label: 'Safras e culturas', to: '/safras', icon: Sprout, module: 'seasons' },
      { label: 'Diário de campo', to: '/diario', icon: BookOpen, module: 'activities' },
      { label: 'Tarefas', to: '/tarefas', icon: ListChecks, module: 'tasks' },
      { label: 'Equipe', to: '/equipe', icon: Users, module: 'team' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Financeiro', to: '/financeiro', icon: Banknote, module: 'finance' },
      { label: 'Orçamento', to: '/orcamento', icon: PiggyBank, module: 'budget' },
      { label: 'Estoque', to: '/estoque', icon: Boxes, module: 'inventory' },
      { label: 'Máquinas e equipamentos', to: '/maquinas', icon: Tractor, module: 'equipment' },
      { label: 'Documentos', to: '/documentos', icon: FileText, module: 'documents' },
      { label: 'Calculadoras', to: '/calculadoras', icon: Calculator },
      { label: 'Relatórios', to: '/relatorios', icon: ScrollText, module: 'reports' },
    ],
  },
  {
    label: 'Tecnologia',
    items: [
      { label: 'Monitoramento por satélite', to: '/satelite', icon: Radar, tag: 'fase 8' },
      { label: 'AgroIA', to: '/agroia', icon: Bot, tag: 'consultas' },
      { label: 'Sensores e integrações', to: '/integracoes', icon: Plug },
    ],
  },
  {
    label: 'Negócios',
    items: [
      { label: 'Marketplace', to: '/marketplace', icon: Store, module: 'marketplace' },
      { label: 'Meus anúncios', to: '/marketplace/meus-anuncios', icon: Tag, module: 'marketplace' },
      { label: 'Mensagens', to: '/marketplace/mensagens', icon: MessagesSquare, module: 'marketplace' },
      { label: 'Favoritos', to: '/marketplace/favoritos', icon: Heart, module: 'marketplace' },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { label: 'Configurações', to: '/configuracoes', icon: Settings },
      { label: 'Moderação', to: '/marketplace/moderacao', icon: Shield, module: '__platform_admin' },
    ],
  },
]
