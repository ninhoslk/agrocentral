import { expect, test, type Browser, type Page } from '@playwright/test'

const A = { email: process.env.E2E_USER_A_EMAIL!, password: process.env.E2E_USER_A_PASSWORD! }
const B = { email: process.env.E2E_USER_B_EMAIL!, password: process.env.E2E_USER_B_PASSWORD! }
const RUN = Date.now().toString(36)

async function login(page: Page, u: { email: string; password: string }) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(u.email)
  await page.getByLabel('Senha').fill(u.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible()
}

async function newUserPage(browser: Browser, u: { email: string; password: string }) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, u)
  return page
}

const ROUTES = [
  '/', '/notificacoes', '/clima', '/mercado', '/propriedades', '/mapa', '/talhoes', '/safras', '/diario', '/tarefas', '/equipe',
  '/financeiro', '/estoque', '/maquinas', '/documentos', '/calculadoras', '/relatorios', '/satelite', '/agroia', '/integracoes',
  '/marketplace', '/marketplace/meus-anuncios', '/marketplace/mensagens', '/marketplace/favoritos', '/marketplace/novo',
  '/configuracoes/perfil', '/configuracoes/organizacao', '/configuracoes/usuarios', '/configuracoes/preferencias',
  '/configuracoes/alertas', '/configuracoes/plano', '/configuracoes/auditoria',
]

test('todas as páginas carregam sem erros de execução', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ResizeObserver/.test(m.text())) errors.push(`${page.url()}: ${m.text()}`) })
  await login(page, A)
  for (const r of ROUTES) {
    await page.goto(r)
    await expect(page.locator('h1').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Não foi possível carregar'), `erro em ${r}`).toHaveCount(0)
  }
  expect(errors, errors.join('\n')).toEqual([])
})

test('tarefas: criar e mover de status', async ({ page }) => {
  await login(page, A)
  await page.goto('/tarefas')
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  await page.getByLabel('Título').fill(`Tarefa E2E ${RUN}`)
  await page.getByLabel('Prioridade').selectOption('alta')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(`Tarefa E2E ${RUN}`)).toBeVisible()
  const card = page.locator('li', { hasText: `Tarefa E2E ${RUN}` })
  await card.getByLabel('Mover para').selectOption('concluida')
  await page.getByLabel('Mostrar concluídas/canceladas').check()
  await expect(page.getByRole('region', { name: 'Concluída' }).getByText(`Tarefa E2E ${RUN}`)).toBeVisible()
})

test('financeiro: despesa em 3 parcelas com centavos exatos', async ({ page }) => {
  await login(page, A)
  await page.goto('/financeiro?novo=despesa')
  await page.getByLabel('Descrição').fill(`Despesa E2E ${RUN}`)
  await page.getByLabel('Categoria').selectOption({ label: 'Energia' })
  await page.getByLabel('Valor total').fill('100')
  await page.getByLabel('Parcelas').fill('3')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Salvo com sucesso')).toBeVisible()
  // parcelas futuras podem cair fora do período padrão; contas em aberto não dependem do período
  await page.getByRole('tab', { name: /Contas a pagar/ }).click()
  await page.getByLabel('Buscar na tabela').fill(`Despesa E2E ${RUN}`)
  await expect(page.getByText(/parcela 1\/3/)).toBeVisible()
  await expect(page.getByText(/parcela 3\/3/)).toBeVisible()
  await expect(page.getByText(/−R\$\s33,34/)).toBeVisible()
})

test('diário de campo: insumo lançado baixa o estoque', async ({ page }) => {
  await login(page, A)
  await page.goto('/estoque')
  const row = page.locator('tr', { hasText: 'Cloreto de potássio' })
  const before = Number((await row.locator('td').nth(2).innerText()).replace(/[^\d,]/g, '').replace(',', '.'))
  await page.goto('/diario?novo=1')
  await page.getByLabel('Tipo de atividade').selectOption({ label: 'Adubação' })
  await page.getByLabel('Descrição curta').fill(`Cobertura E2E ${RUN}`)
  await page.getByRole('button', { name: 'Adicionar insumo' }).click()
  const insumo = page.getByLabel('Insumo', { exact: true })
  const optValue = await insumo.locator('option', { hasText: 'Cloreto de potássio' }).getAttribute('value')
  await insumo.selectOption(optValue!)
  await page.getByLabel('Quantidade', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Salvar atividade' }).click()
  await expect(page.getByText('Atividade registrada')).toBeVisible()
  await page.goto('/estoque')
  await expect(async () => {
    const after = Number((await page.locator('tr', { hasText: 'Cloreto de potássio' }).locator('td').nth(2).innerText()).replace(/[^\d,]/g, '').replace(',', '.'))
    expect(after).toBeCloseTo(before - 100, 3)
  }).toPass()
})

test('calculadora: custo por hectare', async ({ page }) => {
  await login(page, A)
  await page.goto('/calculadoras')
  await page.getByLabel('Custo total').fill('50000')
  await page.getByRole('textbox', { name: 'Área', exact: true }).fill('10')
  await expect(page.getByText(/R\$\s5\.000,00/)).toBeVisible()
})

test('marketplace: anunciar, buscar, conversar e aceitar proposta (entre usuários)', async ({ browser }) => {
  const a = await newUserPage(browser, A)
  const title = `Trator teste E2E ${RUN}`
  await a.goto('/marketplace/novo')
  await a.getByRole('button', { name: 'Tratores' }).click()
  await a.getByRole('button', { name: 'Continuar' }).click()
  await a.getByLabel('Título').fill(title)
  await a.getByLabel('Descrição').fill('Trator em ótimo estado, revisado, pneus novos. Anúncio de teste automatizado.')
  await a.getByLabel('Preço', { exact: true }).fill('150000')
  await a.getByLabel('UF').selectOption('GO')
  await a.getByLabel('Município').selectOption('Rio Verde')
  await a.getByRole('button', { name: 'Continuar' }).click()
  await a.getByRole('button', { name: 'Continuar' }).click()
  await a.getByRole('button', { name: 'Publicar anúncio' }).click()
  await expect(a.getByRole('heading', { name: title })).toBeVisible()

  const b = await newUserPage(browser, B)
  await b.goto('/marketplace')
  await b.getByLabel('Buscar anúncios').fill(`E2E ${RUN}`)
  await b.getByRole('button', { name: 'Buscar' }).click()
  await b.getByText(title).first().click()
  await b.getByRole('button', { name: /Tenho interesse/ }).click()
  await b.getByLabel('Mensagem').fill('Olá, ainda disponível?')
  await b.getByLabel('Proposta de valor (opcional)').fill('140000')
  await b.getByRole('button', { name: 'Enviar' }).click()
  await expect(b.getByText(/Proposta: R\$\s140\.000,00 · pendente/)).toBeVisible()

  await a.goto('/marketplace/mensagens')
  await a.getByText(title).first().click()
  await a.getByRole('button', { name: 'Aceitar' }).click()
  await expect(a.getByText(/Proposta: R\$\s140\.000,00 · aceita/)).toBeVisible()

  await a.context().close()
  await b.context().close()
})

test('isolamento: usuário B não acessa dados da organização A pela interface', async ({ browser }) => {
  const b = await newUserPage(browser, B)
  await b.goto('/propriedades')
  await expect(b.getByText('Fazenda Boa Esperança')).toHaveCount(0)
  await b.goto('/financeiro')
  await b.getByRole('tab', { name: /Lançamentos/ }).click()
  await expect(b.getByText('Venda milho safrinha')).toHaveCount(0)
  await b.context().close()
})
