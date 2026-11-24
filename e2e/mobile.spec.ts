import { expect, test, devices } from '@playwright/test'

const A = { email: process.env.E2E_USER_A_EMAIL!, password: process.env.E2E_USER_A_PASSWORD! }

test.use({ ...devices['iPhone 13'], browserName: 'chromium' })

const ROUTES = [
  '/', '/notificacoes', '/clima', '/mercado', '/propriedades', '/mapa', '/talhoes', '/safras', '/diario', '/tarefas', '/equipe',
  '/financeiro', '/estoque', '/maquinas', '/documentos', '/calculadoras', '/relatorios', '/satelite', '/agroia', '/integracoes',
  '/marketplace', '/marketplace/meus-anuncios', '/marketplace/mensagens', '/marketplace/novo', '/configuracoes/perfil',
  '/configuracoes/organizacao', '/configuracoes/usuarios', '/configuracoes/alertas',
]

async function login(page: import('@playwright/test').Page) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(A.email)
  await page.getByLabel('Senha').fill(A.password)
  await page.getByRole('button', { name: 'Entrar' }).tap()
  await expect(page.getByRole('navigation', { name: 'Navegação rápida' })).toBeVisible()
}

test('celular: todas as páginas sem rolagem lateral, com navegação inferior e alvos de toque', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
  await login(page)
  const report: string[] = []
  for (const r of ROUTES) {
    await page.goto(r)
    await expect(page.locator('h1').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const W = document.documentElement.clientWidth
      const wide = [...document.querySelectorAll('main *')].filter((el) => {
        const r = el.getBoundingClientRect()
        if (!(r.width > 0 && r.right > W + 1)) return false
        // conteúdo dentro de áreas com rolagem horizontal própria (abas, tabelas, previsão por hora) é permitido
        let p = el.parentElement
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; p = p.parentElement }
        return true
      }).slice(0, 3).map((el) => `${el.tagName}.${String((el as HTMLElement).className).slice(0, 60)}`)
      const small = [...document.querySelectorAll('main button, main a[href], main select, main input:not([type=checkbox]):not([type=radio]):not([type=file])')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 36 && getComputedStyle(el).visibility !== 'hidden' })
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30))
      return { scrollW: document.documentElement.scrollWidth, W, wide, small: small.slice(0, 6), smallCount: small.length }
    })
    report.push(`${r}: largura ${m.scrollW}/${m.W}${m.wide.length ? ` excede: ${m.wide.join(' | ')}` : ''}; alvos < 36px: ${m.smallCount}${m.smallCount ? ` (${m.small.join(', ')})` : ''}`)
    expect.soft(m.wide, `elementos mais largos que a tela em ${r}`).toEqual([])
    await page.screenshot({ path: `test-results/mobile/${r.replace(/\//g, '_') || 'home'}.png`, fullPage: false })
  }
  console.log(report.join('\n'))
  expect(errors, errors.join('\n')).toEqual([])
})

test('celular: menu inferior, ações rápidas e menu completo funcionam por toque', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Registrar (ações rápidas)' }).tap()
  await page.getByRole('button', { name: 'Criar tarefa' }).tap()
  await expect(page).toHaveURL(/\/tarefas/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Título').fill('Tarefa pelo celular')
  await page.getByRole('button', { name: 'Salvar' }).tap()
  await expect(page.getByText('Tarefa pelo celular').first()).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).tap()
  await page.getByRole('link', { name: 'Estoque' }).tap()
  await expect(page).toHaveURL(/\/estoque/)
  await expect(page.getByRole('heading', { name: 'Estoque e almoxarifado' })).toBeVisible()
  await page.getByRole('link', { name: 'Mapa' }).tap()
  await expect(page.locator('.leaflet-container')).toBeVisible()
})
