import type { Page } from '@playwright/test'
import { fixture } from './support/mock-api'
import { DESKTOP, expect, MOBILE, signIn, test } from './support/test'

// Checagens de estrutura que o jsdom do Vitest não enxerga (layout real no Chromium).

function drawer(page: Page) {
  return page.locator('.v-navigation-drawer')
}

test.describe('Menu lateral no desktop', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('fica visível dentro da liga, ao lado do conteúdo, e navega', async ({ page }) => {
    await page.goto('/admin/liga/1')
    const header = page.locator('[data-test=dashboard-header]')
    await expect(header).toBeVisible()

    // FOOT-0022: o drawer permanente ficava fora da tela e nenhum teste pegava.
    await expect(drawer(page)).toBeInViewport({ ratio: 1 })
    const drawerBox = await drawer(page).boundingBox()
    const headerBox = await header.boundingBox()
    expect(drawerBox!.width).toBeGreaterThan(0)
    expect(headerBox!.x).toBeGreaterThanOrEqual(drawerBox!.x + drawerBox!.width)

    await drawer(page).getByRole('link', { name: 'Times' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/times$/)
    await expect(drawer(page)).toBeInViewport({ ratio: 1 })
  })

  test('fica visível no Meu perfil, fora das rotas de liga', async ({ page }) => {
    await page.goto('/admin/perfil')
    await expect(page.locator('[data-test=account-card]')).toBeVisible()
    await expect(drawer(page)).toBeInViewport({ ratio: 1 })
    await expect(drawer(page).getByRole('link', { name: 'Dashboard' })).toBeInViewport()
  })

  test('pill de contexto mostra a liga e "Trocar" volta para a seleção', async ({ page }) => {
    await page.goto('/admin/liga/1/estadios')
    const pill = page.locator('.context-pill')
    await expect(pill).toContainText('Copa Footfy')
    await expect(pill).toContainText('Série A')

    await pill.getByRole('button', { name: 'Trocar' }).click()
    await expect(page).toHaveURL(/\/admin\/selecionar$/)
    await expect(page.locator('[data-test=championship-card]')).toHaveCount(2)
  })

  // BUG-034: links com `:to` sem leagueId lançavam "Missing required param" ao sair da liga
  // (o fixture `api` falha o teste com qualquer pageerror).
  const LEAGUE_SCREENS = [
    { name: 'dashboard', path: '/admin/liga/1', ready: '[data-test=dashboard-header]' },
    { name: 'detalhe do time', path: '/admin/liga/1/times/1', ready: '[data-test=team-title]' },
    {
      name: 'detalhe da partida',
      path: '/admin/liga/1/partidas/1',
      ready: '[data-test=game-score]',
    },
    {
      name: 'detalhe do jogador',
      path: '/admin/liga/1/times/1/jogadores/4',
      ready: '[data-test=player-title]',
    },
    {
      name: 'detalhe da comissão técnica',
      path: '/admin/liga/1/times/1/comissao-tecnica/1',
      ready: '[data-test=member-title]',
    },
  ]

  for (const screen of LEAGUE_SCREENS) {
    test(`"Trocar" a partir do ${screen.name} sai da liga sem erro no console`, async ({
      page,
    }) => {
      await page.goto(screen.path)
      await expect(page.locator(screen.ready)).toBeVisible()

      await page.locator('.context-pill').getByRole('button', { name: 'Trocar' }).click()
      await expect(page).toHaveURL(/\/admin\/selecionar$/)
      await expect(page.locator('[data-test=championship-card]')).toHaveCount(2)
    })

    test(`"Sair" a partir do ${screen.name} vai para o login sem erro no console`, async ({
      page,
    }) => {
      await page.goto(screen.path)
      await expect(page.locator(screen.ready)).toBeVisible()

      await page.locator('[data-test=account-menu]').click()
      await page.locator('[data-test=logout]').click()
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('textbox', { name: 'CPF' })).toBeVisible()
    })
  }

  test('tooltip do gráfico de gols aparece no hover', async ({ page }) => {
    await page.goto('/admin/liga/1')
    await page.locator('[data-test=goals-bar]').first().hover()

    // Os tooltips já abertos uma vez continuam no DOM: só o ativo interessa.
    const tooltip = page.locator('.v-tooltip.v-overlay--active > .v-overlay__content')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(/3 gols\s*· Rodada 1/)
    await expect(tooltip).toBeInViewport()
  })
})

test.describe('Menu lateral no mobile', () => {
  test.use({ viewport: MOBILE })

  test('abre pelo ícone do app bar e fecha ao navegar', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/liga/1')
    await expect(page.locator('[data-test=dashboard-header]')).toBeVisible()
    await expect(drawer(page)).not.toBeInViewport()

    await page.locator('.v-app-bar-nav-icon').click()
    await expect(drawer(page)).toBeInViewport({ ratio: 1 })

    await drawer(page).getByRole('link', { name: 'Estádios' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/estadios$/)
    await expect(drawer(page)).not.toBeInViewport()
  })

  test('pill de contexto cabe no app bar com o botão "Trocar"', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/liga/1')
    const pill = page.locator('.context-pill')
    await expect(pill).toContainText('Série A')
    await expect(pill.getByRole('button', { name: 'Trocar' })).toBeInViewport({ ratio: 1 })
  })
})

// Tela + algo que só aparece depois que os dados carregaram.
interface MobileScreen {
  path: string
  ready: string
  role?: 'master' | 'admin'
  // Bug conhecido que ainda quebra a checagem: o teste fica marcado como falha esperada.
  knownBug?: string
}

const MOBILE_SCREENS: MobileScreen[] = [
  { path: '/', ready: 'text=Campeonatos em destaque' },
  { path: '/ligas/1', ready: 'text=Atlético Serrano' },
  { path: '/times/1', ready: 'text=Lucas Ferreira' },
  { path: '/admin/selecionar', ready: '[data-test=championship-card]', role: 'admin' },
  { path: '/admin/selecionar', ready: '[data-test=championship-card]', role: 'master' },
  { path: '/admin/liga/1', ready: '[data-test=dashboard-counter]', role: 'master' },
  { path: '/admin/liga/1/times', ready: '[data-test=team-card]', role: 'master' },
  { path: '/admin/liga/1/times/1', ready: '[data-test=players-table] tbody tr', role: 'master' },
  { path: '/admin/liga/1/estadios', ready: '[data-test=stadiums-table] tbody tr', role: 'master' },
  { path: '/admin/liga/1/partidas', ready: '[data-test=games-table] tbody tr', role: 'master' },
  { path: '/admin/liga/1/partidas/1', ready: '[data-test=game-score]', role: 'master' },
  { path: '/admin/liga/1/usuarios', ready: '[data-test=users-table] tbody tr', role: 'master' },
  { path: '/admin/liga/1/tabela', ready: '[data-test=standings-row]', role: 'master' },
  { path: '/admin/liga/1/estatisticas', ready: '[data-test=top-scorers]', role: 'master' },
  { path: '/admin/perfil', ready: '[data-test=account-card]', role: 'master' },
]

test.describe('Sem rolagem horizontal no mobile', () => {
  test.use({ viewport: MOBILE })

  for (const screen of MOBILE_SCREENS) {
    test(`${screen.path}${screen.role ? ` (${screen.role})` : ''}`, async ({ page }) => {
      test.fail(!!screen.knownBug, screen.knownBug)
      if (screen.role) await signIn(page, { role: screen.role })
      await page.goto(screen.path)
      await expect(page.locator(screen.ready).first()).toBeVisible()

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, 'scrollWidth da página maior que a largura da tela').toBeLessThanOrEqual(
        clientWidth,
      )
    })
  }
})

// BUG-013: em telas estreitas os três botões com texto estouravam o app bar público.
test.describe('App bar pública no mobile', () => {
  for (const width of [320, 400]) {
    for (const loggedIn of [false, true]) {
      test(`${width}px ${loggedIn ? 'logado' : 'deslogado'}: todos os botões cabem`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 })
        if (loggedIn) await signIn(page)
        await page.goto('/')
        await expect(page.getByText('Campeonatos em destaque')).toBeVisible()

        const appBar = page.locator('.v-app-bar')
        await expect(appBar.getByRole('link', { name: 'Campeonatos' })).toBeInViewport({ ratio: 1 })
        const last = appBar.getByRole('link', { name: loggedIn ? 'Painel' : 'Entrar' })
        await expect(last).toHaveText(loggedIn ? 'Painel' : 'Entrar')
        await expect(last).toBeInViewport({ ratio: 1 })
      })
    }
  }
})

// BUG-036: "Início" ficava ativo em toda tela pública. Confere também que o destaque aparece de
// fato (overlay do v-btn), coisa que o jsdom não calcula.
test.describe('App bar pública marca a página atual', () => {
  // No mobile "Início" não aparece (o logo leva à home) e "Campeonatos" é só o ícone.
  const SCREENS = [
    { path: '/', ready: 'text=Campeonatos em destaque', desktop: ['Início'], mobile: [] },
    { path: '/campeonatos', ready: 'text=Torneio de Verão', desktop: ['Campeonatos'] },
    { path: '/ligas/1', ready: 'text=Atlético Serrano', desktop: ['Campeonatos'] },
    { path: '/times/1', ready: 'text=Lucas Ferreira', desktop: ['Campeonatos'] },
  ]

  for (const [mode, viewport] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    for (const screen of SCREENS) {
      const expected = (mode === 'mobile' && screen.mobile) || screen.desktop

      test(`${mode} ${screen.path}: ativo ${expected.join() || 'nenhum'}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(screen.path)
        await expect(page.locator(screen.ready).first()).toBeVisible()

        const buttons = await page.locator('.v-app-bar a.v-btn').evaluateAll((links) =>
          links.map((link) => ({
            label: link.textContent?.trim() || link.getAttribute('aria-label'),
            current: link.getAttribute('aria-current'),
            highlighted:
              Number(getComputedStyle(link.querySelector('.v-btn__overlay')!).opacity) > 0,
          })),
        )
        expect(buttons.filter((b) => b.current === 'page').map((b) => b.label)).toEqual(expected)
        expect(buttons.filter((b) => b.highlighted).map((b) => b.label)).toEqual(expected)
      })
    }
  }
})

// BUG-031: o v-card-title cortava o nome do time com reticências.
test('detalhe público do time mostra o nome longo inteiro em 390px', async ({ page, api }) => {
  const longName = 'Sport Club Corinthians Paulista'
  const team = fixture<{ data: { name: string } }>('public-team-1')
  team.data.name = longName
  api.on('GET', '/public/teams/1', { body: team })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/times/1')
  const title = page.getByRole('heading', { name: longName })
  await expect(title).toHaveText(longName)
  await expect(title).toBeInViewport({ ratio: 1 })

  const overflow = await title.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(overflow, 'o título não pode ter texto escondido na horizontal').toBeLessThanOrEqual(0)
})
