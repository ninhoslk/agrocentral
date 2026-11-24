import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Logo } from '@/app/layouts/Logo'

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="bg-brand-950 px-6 py-4"><Link to="/"><Logo /></Link></header>
      <article className="mx-auto max-w-3xl space-y-4 px-6 py-10 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
          Minuta preliminar para a fase de demonstração/piloto. Deve ser revisada por assessoria jurídica antes da operação comercial pública.
        </p>
        {children}
      </article>
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Termos de uso">
      <h2>1. Objeto</h2>
      <p>A AgroCentral oferece ferramentas de gestão rural, informações de clima e mercado e um marketplace para aproximação entre usuários.</p>
      <h2>2. Dados de terceiros</h2>
      <p>Informações de clima, câmbio e cotações provêm de fontes externas indicadas junto a cada dado, com horário de atualização e status. Previsões não são certezas e não substituem avisos oficiais (ex.: INMET). Cotações de referência não são preços negociáveis.</p>
      <h2>3. Calculadoras e recomendações</h2>
      <p>Os resultados das calculadoras são apoio à decisão e não substituem a recomendação de engenheiro agrônomo ou responsável técnico.</p>
      <h2>4. Marketplace</h2>
      <p>A AgroCentral apenas aproxima anunciantes e interessados. Não intermedia pagamentos, não garante entrega, procedência, qualidade ou documentação dos itens. Verifique máquinas, documentos e condições antes de negociar. Anúncios de produtos que exigem registro ou receituário devem cumprir a legislação; anúncios irregulares serão removidos.</p>
      <h2>5. Conta e segurança</h2>
      <p>O usuário é responsável pelo sigilo da senha e pelos acessos concedidos a colaboradores da sua organização.</p>
      <h2>6. Contato</h2>
      <p>Canal de contato a ser publicado antes da operação pública.</p>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Política de privacidade">
      <h2>Princípios (LGPD)</h2>
      <p>Tratamos dados pessoais com finalidade específica, necessidade, transparência e segurança, conforme a Lei 13.709/2018.</p>
      <h2>Dados tratados</h2>
      <p>Cadastro (nome, e-mail, telefone opcional), dados das propriedades e operações informados pelo usuário, documentos enviados e mensagens do marketplace.</p>
      <h2>Isolamento e segurança</h2>
      <p>Os dados de cada organização são isolados por políticas de acesso no banco de dados (Row Level Security). Arquivos são privados e acessados por links temporários. Conexões são criptografadas.</p>
      <h2>Compartilhamento</h2>
      <p>Não vendemos dados. Coordenadas das propriedades podem ser enviadas a provedores de previsão do tempo apenas de forma aproximada, para obter a previsão local.</p>
      <h2>Direitos do titular</h2>
      <p>Você pode solicitar acesso, correção, portabilidade e exclusão dos seus dados. A exportação dos registros pode ser feita nas próprias telas (CSV/XLSX/PDF).</p>
      <h2>Notificações</h2>
      <p>Notificações opcionais exigem consentimento e podem ser desativadas a qualquer momento em Configurações → Alertas.</p>
    </LegalShell>
  )
}
