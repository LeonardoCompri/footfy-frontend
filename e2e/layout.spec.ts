import type { Page } from '@playwright/test'
import { sampleImageUrl } from './support/images'
import { fixture, type MockApi } from './support/mock-api'
import { DESKTOP, expect, MOBILE, openDialog, signIn, test } from './support/test'

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

    const tooltip = page.locator('.v-tooltip.v-overlay--active > .v-overlay__content')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(/3 gols\s*· Rodada 1/)
    await expect(tooltip).toBeInViewport()
  })

  test('recolhido, o cabeçalho mostra só o símbolo e a navegação começa no topo', async ({
    page,
  }) => {
    await page.goto('/admin/liga/1')
    await expect(page.locator('[data-test=dashboard-header]')).toBeVisible()

    await drawer(page).getByText('Recolher').click()
    await expect(drawer(page)).toHaveClass(/v-navigation-drawer--rail/)
    await expect(page.getByText('Painel Administrativo')).toHaveCount(0)
    await expect.poll(async () => (await drawer(page).boundingBox())!.width).toBe(56)

    const brand = drawer(page).locator('[data-test=drawer-brand]')
    await expect.poll(async () => (await brand.boundingBox())!.height).toBeLessThanOrEqual(64)
    const symbol = await brand.getByRole('img', { name: 'Futy' }).boundingBox()
    const firstItem = await drawer(page).locator('.v-list-item[href]').first().boundingBox()
    expect(firstItem!.y).toBeLessThan(130)
    const itemIcon = await drawer(page).locator('.v-list-item[href] .v-icon').first().boundingBox()
    expect(
      Math.abs(symbol!.x + symbol!.width / 2 - (itemIcon!.x + itemIcon!.width / 2)),
    ).toBeLessThanOrEqual(2)
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

interface MobileScreen {
  path: string
  ready: string
  role?: 'master' | 'admin'
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
  { path: '/admin/campeonatos/1/editar', ready: '[data-test=league-panel]', role: 'master' },
  {
    path: '/admin/campeonatos/novo',
    ready: '[data-test=championship-image-empty]',
    role: 'master',
  },
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

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

test.describe('Imagem do campeonato no mobile', () => {
  test.use({ viewport: MOBILE })

  test('área da imagem em largura total, botões com alvo de 44px e diálogo sem rolagem', async ({
    page,
    api,
  }) => {
    const championship = fixture<{ data: { image: string | null } }>('championship-1')
    championship.data.image = sampleImageUrl('Copa Footfy', '#2e7d32')
    api.on('GET', '/championships/1', { body: championship })
    await signIn(page)
    await page.goto('/admin/campeonatos/1/editar')

    const name = page.locator('[data-test=championship-name]')
    const area = page.locator('[data-test=championship-image-preview]')
    await expect(area.locator('[data-test=championship-image-front] img')).toBeVisible()
    const nameBox = (await name.boundingBox())!
    const areaBox = (await area.boundingBox())!
    expect(areaBox.y, 'a imagem fica abaixo do nome').toBeGreaterThan(nameBox.y + nameBox.height)
    expect(areaBox.width).toBeCloseTo(nameBox.width, 0)
    expect(areaBox.height).toBe(200)

    for (const button of [
      page.getByRole('button', { name: 'Trocar imagem' }),
      page.getByRole('button', { name: 'Visualizar aplicação' }),
    ]) {
      await expect(button).toBeInViewport({ ratio: 1 })
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: 'Visualizar aplicação' }).click()
    const dialog = openDialog(page).locator('[data-test=image-preview-dialog]')
    await expect(dialog).toContainText('Como a imagem aparece')
    await expect
      .poll(async () => (await dialog.boundingBox())!.width, { message: 'diálogo em tela cheia' })
      .toBe(MOBILE.width)
    const overflow = await dialog
      .locator(':scope > .v-card-text')
      .evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow, 'conteúdo do diálogo sem rolagem horizontal').toBeLessThanOrEqual(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('Placar do detalhe da partida no mobile', () => {
  for (const viewport of [MOBILE, { width: 360, height: 800 }]) {
    test(`${viewport.width}px: nome de cada time em uma linha, abaixo do placar`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page)
      await page.goto('/admin/liga/1/partidas/1')
      const score = page.locator('[data-test=game-score]')
      await expect(score).toBeVisible()

      const scoreBox = (await score.boundingBox())!
      for (const [selector, name] of [
        ['[data-test=game-home-name]', 'Serrano'],
        ['[data-test=game-away-name]', 'Ribeirinho'],
      ]) {
        const label = page.locator(selector)
        await expect(label).toHaveText(name)
        const { height, lineHeight } = await label.evaluate((el) => ({
          height: el.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        }))
        expect(height, `${name} quebrou em mais de uma linha`).toBeLessThanOrEqual(lineHeight * 1.5)
        expect((await label.boundingBox())!.y).toBeGreaterThan(scoreBox.y + scoreBox.height)
      }
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
  }
})

test.describe('Formulário de partida em liga híbrida', () => {
  async function openNewGame(page: Page, api: MockApi) {
    const leagues = fixture<{ data: { id: number; format: string }[] }>('leagues')
    leagues.data[0].format = 'hybrid'
    api.on('GET', '/leagues', { body: leagues })
    await signIn(page)
    await page.goto('/admin/liga/1/partidas')
    await page.locator('[data-test=game-create]').click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=game-stage-toggle]')).toBeVisible()
    return dialog
  }

  test('360px: o alternador cabe inteiro e a Fase tem borda como os outros campos', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 360, height: 760 })
    const dialog = await openNewGame(page, api)
    const toggle = dialog.locator('[data-test=game-stage-toggle]')

    expect(await toggle.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
    for (const name of ['Rodada', 'Fase']) {
      await expect(toggle.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 })
    }

    await toggle.getByRole('button', { name: 'Fase', exact: true }).click()
    await expect(dialog.locator('[data-test=game-phase] .v-field')).toHaveClass(
      /v-field--variant-outlined/,
    )
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('desktop: o alternador mostra os rótulos completos', async ({ page, api }) => {
    await page.setViewportSize(DESKTOP)
    const dialog = await openNewGame(page, api)
    const toggle = dialog.locator('[data-test=game-stage-toggle]')

    await expect(toggle.getByRole('button', { name: 'Rodada (grupos)' })).toBeVisible()
    await expect(toggle.getByRole('button', { name: 'Fase (mata-mata)' })).toBeVisible()
    expect(await toggle.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  })
})

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

test.describe('App bar pública marca a página atual', () => {
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
