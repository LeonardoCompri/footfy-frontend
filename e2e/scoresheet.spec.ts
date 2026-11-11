import type { Page } from '@playwright/test'
import { fixture, type MockApi } from './support/mock-api'
import { expect, signIn, test } from './support/test'

type GameFixture = {
  data: Record<string, unknown> & { homeTeam: { players: unknown[] } }
}

const SHEET = '[data-test=scoresheet-sheet]'

type Status = 'scheduled' | 'finished'

function game1(status: Status): GameFixture {
  const game = fixture<GameFixture>('game-1')
  game.data.status = status
  return game
}

function knockoutGame(status: Status = 'scheduled', extra: Record<string, unknown> = {}) {
  const game = game1(status)
  Object.assign(game.data, {
    round: null,
    phase: 'Final',
    phase_order: 4,
    tie_key: 'F1',
    leg: null,
    knockout_stage: 'F',
    penalties_possible: true,
    ...extra,
  })
  return game
}

function largeRosterGame(size: number): GameFixture {
  const game = game1('scheduled')
  game.data.homeTeam.players = Array.from({ length: size }, (_, index) => ({
    id: 100 + index,
    team_id: 1,
    name: `Atleta ${index + 1}`,
    position: null,
    number: index + 1,
    birth_date: null,
    document: null,
    created_at: '',
    updated_at: '',
  }))
  return game
}

function manyEventsGame(count: number): GameFixture {
  const game = game1('finished')
  game.data.events = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    game_id: 1,
    team_id: index % 2 === 0 ? 1 : 2,
    player_id: 4,
    related_player_id: null,
    player: { id: 4, name: `Atleta ${index + 1}`, number: index + 1, removed: false },
    related_player: null,
    league_id: 1,
    type: 'goal',
    minute: index + 1,
    created_at: '',
    updated_at: '',
  }))
  return game
}

const LONG_NAMES = [
  'Maximiliano Augusto de Albuquerque Figueiredo',
  'João Pedro dos Santos Oliveira Nascimento Júnior',
  'Carlos Eduardo Vasconcelos de Andrade Filho',
  'Wellington Rodrigues Cavalcante da Silva',
]

function withLimit(game: GameFixture, limit: number) {
  ;(game.data.league as { max_players_per_team?: number }).max_players_per_team = limit
  return game
}

function fullRosters(game: GameFixture, size = 35) {
  const roster = (teamId: number) =>
    Array.from({ length: size }, (_, index) => ({
      id: teamId * 1000 + index,
      team_id: teamId,
      name: LONG_NAMES[index % LONG_NAMES.length],
      position: null,
      number: index + 1,
      birth_date: null,
      document: '52998224725',
      created_at: '',
      updated_at: '',
    }))
  game.data.homeTeam.players = roster(1)
  ;(game.data.awayTeam as { players: unknown[] }).players = roster(2)
  return game
}

function worstCaseGame(status: Status, size = 35) {
  const game = fullRosters(
    knockoutGame(status, status === 'finished' ? { home_penalties: 4, away_penalties: 3 } : {}),
    size,
  )
  const data = game.data as unknown as {
    homeTeam: { name: string }
    awayTeam: { name: string }
    league: { name: string; championship: { name: string } }
    stadium: { name: string; city: string }
    leg: number
    phase: string
  }
  data.homeTeam.name = 'Associação Atlética Recreativa União Vila Nova do Sul'
  data.awayTeam.name = 'Sociedade Esportiva Beneficente Operários de Santa Terezinha'
  data.league.name = 'Categoria Veteranos Quarentões Divisão Especial'
  data.league.championship.name = 'Campeonato Municipal Amador de Futebol de Campo 2026'
  data.stadium.name = 'Estádio Municipal Governador Ernesto Pereira Lopes'
  data.stadium.city = 'São José do Rio Preto'
  data.leg = 2
  data.phase = 'Semifinal'
  return game
}

function kicks(perTeam: number) {
  return Array.from({ length: perTeam * 2 }, (_, index) => ({
    id: index + 1,
    order: index + 1,
    team_id: index % 2 === 0 ? 1 : 2,
    player_id: index + 1,
    scored: index % 2 === 0,
    player: { id: index + 1, name: 'João Silva', number: (index % 99) + 1, removed: false },
  }))
}

async function openScoresheet(page: Page, api: MockApi, game?: GameFixture) {
  if (game) api.on('GET', '/games/1', { body: game })
  await signIn(page)
  await page.goto('/admin/liga/1/partidas/1/sumula')
  await expect(page.locator(SHEET).first()).toBeVisible()
}

async function sheetsOverflow(page: Page) {
  return page.locator(SHEET).evaluateAll((sheets) =>
    sheets.map((sheet) => {
      const box = sheet.getBoundingClientRect()
      const foot = sheet.querySelector('.foot')!.getBoundingClientRect()
      return {
        overflow: sheet.scrollHeight - sheet.clientHeight,
        overflowX: sheet.scrollWidth - sheet.clientWidth,
        footBelow: Math.round(foot.bottom - box.bottom),
      }
    }),
  )
}

async function expectSheetsFit(page: Page) {
  for (const sheet of await sheetsOverflow(page)) {
    expect(sheet.overflow, 'conteúdo passou da folha').toBeLessThanOrEqual(0)
    expect(sheet.overflowX, 'conteúdo passou da largura da folha').toBeLessThanOrEqual(0)
    expect(sheet.footBelow, 'rodapé fora da folha').toBeLessThanOrEqual(0)
  }
}

const CONTENT_LIMIT_MM = 204
const MIN_SLACK_MM = 2
const SHEET_GAP_MM = 2.6

async function rosterFit(page: Page) {
  await page.emulateMedia({ media: 'print' })
  const fit = await page
    .locator(SHEET)
    .first()
    .evaluate((sheet, gap) => {
      const mm = (px: number) => (px * 25.4) / 96
      const top = sheet.getBoundingClientRect().top
      const foot = sheet.querySelector('.foot')!.getBoundingClientRect()
      const hint = sheet.querySelector('.hint')!.getBoundingClientRect()
      const rows = Array.from(sheet.querySelectorAll('[data-test=scoresheet-roster-home] tbody tr'))
      const heights = rows.map((row) => row.getBoundingClientRect().height)
      return {
        rows: rows.length,
        overflow: sheet.scrollHeight - sheet.clientHeight,
        overflowX: sheet.scrollWidth - sheet.clientWidth,
        footBottom: mm(foot.bottom - top),
        slack: mm(foot.top - hint.bottom) - gap,
        rowHeight: mm(heights[0]),
        rowSpread: mm(Math.max(...heights) - Math.min(...heights)),
      }
    }, SHEET_GAP_MM)
  await page.emulateMedia({ media: 'screen' })
  return fit
}

async function selectBlank(page: Page) {
  await page.locator('[data-test=scoresheet-mode-blank]').click()
  await expect(page.locator('[data-test=scoresheet-mode-blank]')).toHaveClass(/v-btn--active/)
}

async function pdfPages(page: Page) {
  await page.emulateMedia({ media: 'print' })
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString(
    'latin1',
  )
  await page.emulateMedia({ media: 'screen' })
  return {
    pages: pdf.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0,
    a4Landscape: [...pdf.matchAll(/\/MediaBox\s*\[([^\]]*)\]/g)].every((box) => {
      const [, , width, height] = box[1].trim().split(/\s+/).map(Number)
      return Math.abs(width - 841.9) < 1 && Math.abs(height - 595.3) < 1
    }),
  }
}

test.describe('Súmula impressa', () => {
  test('pontos corridos: o botão da partida abre 2 folhas A4 paisagem', async ({ page, api }) => {
    api.on('GET', '/games/1', { body: game1('scheduled') })
    await signIn(page)
    await page.goto('/admin/liga/1/partidas/1')
    await page.locator('[data-test=game-print-scoresheet]').click()

    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\/1\/sumula$/)
    const sheets = page.locator(SHEET)
    await expect(sheets).toHaveCount(2)
    await expect(page.locator('[data-test=scoresheet-page]')).toHaveText([
      'Pág. 1 de 2',
      'Pág. 2 de 2',
    ])
    await expect(sheets.first().locator('[data-test=scoresheet-competition]')).toHaveText(
      'Copa Footfy · Série A',
    )
    await expect(sheets.first().locator('[data-test=scoresheet-code]')).toHaveText('Jogo#0001')

    const home = page.locator('[data-test=scoresheet-roster-home]')
    await expect(home.locator('[data-test=scoresheet-coach]')).toHaveText('Téc. Marcos Vieira')
    await expect(
      page.locator('[data-test=scoresheet-roster-away] [data-test=scoresheet-coach]'),
    ).toHaveCount(0)
    await expect(home.locator('[data-test=scoresheet-player]').first()).toContainText(
      '***.982.247-**',
    )
    await expect(home.locator('tbody tr')).toHaveCount(35)
    await expect(sheets.first().locator('.signs')).toHaveCount(0)
    await expect(sheets.nth(1).locator('.sign-label')).toHaveText([
      'Árbitro principal',
      'Capitão · Atlético Serrano',
      'Capitão · Clube Ribeirinho',
    ])
    await expect(page.locator('[data-test=scoresheet-title]')).toHaveText([
      'Súmula oficial de partida - Relação de atletas',
      'Súmula oficial de partida - Registro de eventos e ocorrências',
    ])

    await expect(page.locator('[data-test=scoresheet-legend-type]')).toHaveText([
      'G Gol',
      'GC Gol contra',
      'CA Cartão amarelo',
      'CV Cartão vermelho',
    ])
    await expect(page.locator('[data-test=scoresheet-event-row]')).toHaveCount(18)
    await expect(page.locator('[data-test=scoresheet-mode]')).toHaveCount(0)
    await expect(page.locator(`${SHEET} .cb.on`)).toHaveCount(0)
    await expect(page.locator('[data-test=scoresheet-score-home]')).toHaveText('')
    await expect(page.locator('[data-test=scoresheet-roster-limit]')).toHaveCount(0)

    for (const sheet of await sheetsOverflow(page)) {
      expect(sheet.overflow, 'conteúdo passou da folha').toBeLessThanOrEqual(0)
      expect(sheet.footBelow, 'rodapé fora da folha').toBeLessThanOrEqual(0)
    }
    expect(await pdfPages(page)).toEqual({ pages: 2, a4Landscape: true })

    await page.locator('[data-test=scoresheet-back]').click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\/1$/)
    await expect(page.locator('[data-test=game-score]')).toBeVisible()
  })

  test('mata-mata decisivo: 3 folhas com a disputa de pênaltis em branco', async ({
    page,
    api,
  }) => {
    await openScoresheet(page, api, knockoutGame())

    await expect(page.locator(SHEET)).toHaveCount(3)
    await expect(page.locator('[data-test=scoresheet-page]').last()).toHaveText('Pág. 3 de 3')
    const penalties = page.locator(SHEET).last()
    await expect(penalties.locator('[data-test=scoresheet-title]')).toHaveText(
      'Súmula oficial de partida - Disputa de pênaltis',
    )
    await expect(penalties).not.toContainText('Somente mata-mata')
    await expect(penalties.locator('[data-test=scoresheet-kick]')).toHaveCount(24)
    await expect(penalties).toContainText('Final · Jogo único · desempate: pênaltis')
    await expect(page.locator(SHEET).first()).toContainText(
      'Preencha a disputa de pênaltis na pág. 3',
    )

    for (const sheet of await sheetsOverflow(page)) {
      expect(sheet.overflow).toBeLessThanOrEqual(0)
      expect(sheet.footBelow).toBeLessThanOrEqual(0)
    }
    expect(await pdfPages(page)).toEqual({ pages: 3, a4Landscape: true })
  })

  test('elenco de 35 atletas cabe numa folha só da relação', async ({ page, api }) => {
    await openScoresheet(page, api, largeRosterGame(35))

    await expect(page.locator(SHEET)).toHaveCount(2)
    const home = page.locator(SHEET).first().locator('[data-test=scoresheet-roster-home]')
    await expect(home.locator('[data-test=scoresheet-player]')).toHaveCount(35)
    await expect(home.locator('[data-test=scoresheet-blank]')).toHaveCount(0)
    await expect(home).toContainText('Atleta 35')
    for (const sheet of await sheetsOverflow(page)) {
      expect(sheet.overflow).toBeLessThanOrEqual(0)
    }
    expect((await pdfPages(page)).pages).toBe(2)
  })

  test('elenco acima de 35 atletas ganha uma folha extra da relação', async ({ page, api }) => {
    await openScoresheet(page, api, largeRosterGame(36))

    await expect(page.locator(SHEET)).toHaveCount(3)
    await expect(page.locator('[data-test=scoresheet-page]')).toHaveText([
      'Pág. 1 de 3',
      'Pág. 2 de 3',
      'Pág. 3 de 3',
    ])
    const continuation = page.locator(SHEET).nth(1)
    await expect(continuation).toContainText('Relação de atletas (continuação)')
    await expect(continuation.locator('[data-test=scoresheet-roster-home]')).toContainText(
      'Atleta 36',
    )
    await expect(continuation.locator('[data-test=scoresheet-match]')).toHaveCount(0)
    await expect(continuation.locator('.signs')).toHaveCount(0)
    await expect(continuation.locator('[data-test=scoresheet-roster-home] tbody tr')).toHaveCount(
      35,
    )
    await expect(continuation.locator('[data-test=scoresheet-title]')).toHaveText(
      'Súmula oficial de partida - Relação de atletas (continuação)',
    )
    for (const sheet of await sheetsOverflow(page)) {
      expect(sheet.overflow).toBeLessThanOrEqual(0)
    }
    expect((await pdfPages(page)).pages).toBe(3)
  })

  test('finalizada sai preenchida com os dados do sistema', async ({ page, api }) => {
    await openScoresheet(page, api)

    await expect(page.locator(SHEET)).toHaveCount(2)
    await expect(page.locator('[data-test=scoresheet-score-home]')).toHaveText('2')
    await expect(page.locator('[data-test=scoresheet-score-away]')).toHaveText('1')
    await expect(page.locator('[data-test=scoresheet-roster-hint]')).toHaveText(
      'Relação conforme o cadastro atual do time',
    )
    const rows = page.locator('[data-test=scoresheet-event-row]')
    await expect(rows.nth(0).locator('td').nth(1)).toHaveText('23')
    await expect(rows.nth(0).locator('td').nth(5)).toHaveText('Lucas Ferreira')
    await expect(rows.nth(0).locator('td').nth(7)).toHaveText('Assist.: Diego Martins')
    await expect(rows.nth(0).locator('.cb.on')).toHaveCount(2)
    await expect(rows.nth(3).locator('td').nth(1)).toHaveText('78')
    await expect(rows.nth(4).locator('.cb.on')).toHaveCount(0)
    const events = page.locator(SHEET).nth(1)
    await expect(events.locator('.legend-title')).toHaveText('Legenda')
    await expect(events.locator('.office')).toHaveCount(0)
    await expect(events).not.toContainText('Mais eventos do que linhas')
    await expect(events).toContainText('a partir dos dados do Futy')

    await expectSheetsFit(page)
    expect(await pdfPages(page)).toEqual({ pages: 2, a4Landscape: true })
  })

  test('finalizada pode ser impressa em branco e o controle some na impressão', async ({
    page,
    api,
  }) => {
    await openScoresheet(page, api)
    const control = page.locator('[data-test=scoresheet-mode]')
    await expect(control).toBeVisible()
    await expect(page.locator('[data-test=scoresheet-mode-filled]')).toHaveClass(/v-btn--active/)

    await selectBlank(page)
    await expect(page.locator(SHEET)).toHaveCount(2)
    await expect(page.locator('[data-test=scoresheet-score-home]')).toHaveText('')
    await expect(page.locator(`${SHEET} .cb.on`)).toHaveCount(0)
    await expect(page.locator(SHEET).nth(1).locator('.office')).toBeVisible()
    await expect(page.locator(SHEET).nth(1)).toContainText('Marque com X')
    await expect(page.locator(SHEET).nth(1)).not.toContainText('a partir dos dados do Futy')
    await expectSheetsFit(page)

    await page.emulateMedia({ media: 'print' })
    await expect(control).toBeHidden()
    await page.emulateMedia({ media: 'screen' })
    expect(await pdfPages(page)).toEqual({ pages: 2, a4Landscape: true })

    await page.locator('[data-test=scoresheet-mode-filled]').click()
    await expect(page.locator('[data-test=scoresheet-score-home]')).toHaveText('2')
  })

  test('mais de 18 eventos ganham folha de continuação', async ({ page, api }) => {
    await openScoresheet(page, api, manyEventsGame(25))

    await expect(page.locator(SHEET)).toHaveCount(3)
    await expect(page.locator('[data-test=scoresheet-page]')).toHaveText([
      'Pág. 1 de 3',
      'Pág. 2 de 3',
      'Pág. 3 de 3',
    ])
    const continuation = page.locator(SHEET).nth(2)
    await expect(continuation).toContainText('Registro de eventos (continuação)')
    const rows = continuation.locator('[data-test=scoresheet-event-row]')
    await expect(rows).toHaveCount(18)
    await expect(rows.first().locator('.idx')).toHaveText('19')
    await expect(rows.first().locator('td').nth(5)).toHaveText('Atleta 19')
    await expect(rows.nth(6).locator('td').nth(5)).toHaveText('Atleta 25')
    await expect(rows.nth(7).locator('.cb.on')).toHaveCount(0)
    const clipped = await page
      .locator('[data-test=scoresheet-event-row] .idx')
      .evaluateAll((cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth).length)
    expect(clipped, 'número da linha cortado').toBe(0)
    await expectSheetsFit(page)
    expect(await pdfPages(page)).toEqual({ pages: 3, a4Landscape: true })
  })

  test('finalizada com cobranças imprime a folha 3 preenchida', async ({ page, api }) => {
    await openScoresheet(
      page,
      api,
      knockoutGame('finished', { home_penalties: 5, away_penalties: 0, penaltyKicks: kicks(5) }),
    )

    await expect(page.locator(SHEET)).toHaveCount(3)
    await expect(page.locator('[data-test=scoresheet-penalties-score]')).toHaveText(
      'Pênaltis: 5 × 0',
    )
    const sheet = page.locator(SHEET).last()
    await expect(sheet.locator('[data-test=scoresheet-kicks-home] .mark .fill')).toHaveCount(5)
    await expect(sheet.locator('[data-test=scoresheet-kicks-away] .mark .cross')).toHaveCount(5)
    await expect(sheet.locator('[data-test=scoresheet-kicks-home] .kteam .cb.on')).toHaveCount(1)
    await expect(sheet.locator('[data-test=scoresheet-kicks-home] .total-box')).toHaveText('5')
    await expect(sheet.locator('[data-test=scoresheet-winner-home] .cb.on')).toHaveCount(1)
    await expect(sheet).not.toContainText('Quando preencher')
    await expectSheetsFit(page)
    expect(await pdfPages(page)).toEqual({ pages: 3, a4Landscape: true })

    await selectBlank(page)
    await expect(page.locator(SHEET)).toHaveCount(3)
    await expect(
      page.locator(SHEET).last().locator('[data-test=scoresheet-kick] .fill'),
    ).toHaveCount(0)
    await expect(page.locator(SHEET).last()).toContainText('Quando preencher')
    await expect(page.locator('[data-test=scoresheet-penalties-score]')).toHaveCount(0)
    await expectSheetsFit(page)
    expect((await pdfPages(page)).pages).toBe(3)
  })

  test('finalizada sem pênaltis nunca imprime a folha 3', async ({ page, api }) => {
    await openScoresheet(page, api, knockoutGame('finished'))

    await expect(page.locator(SHEET)).toHaveCount(2)
    await expect(page.locator(SHEET).first()).not.toContainText('Terminou empatado')
    await expectSheetsFit(page)

    await selectBlank(page)
    await expect(page.locator(SHEET)).toHaveCount(2)
    await expect(page.locator(SHEET).first()).not.toContainText('Terminou empatado')
    expect((await pdfPages(page)).pages).toBe(2)
  })

  test('jogo antigo só com placar de pênaltis: placar na folha 1, sem grade', async ({
    page,
    api,
  }) => {
    await openScoresheet(
      page,
      api,
      knockoutGame('finished', { home_penalties: 4, away_penalties: 3 }),
    )

    await expect(page.locator(SHEET)).toHaveCount(2)
    await expect(page.locator('[data-test=scoresheet-kicks]')).toHaveCount(0)
    await expect(page.locator('[data-test=scoresheet-penalties-score]')).toHaveText(
      'Pênaltis: 4 × 3',
    )
    await expectSheetsFit(page)
    expect((await pdfPages(page)).pages).toBe(2)

    await selectBlank(page)
    await expect(page.locator(SHEET)).toHaveCount(3)
    await expectSheetsFit(page)
    expect((await pdfPages(page)).pages).toBe(3)
  })

  test('mais de 12 cobranças por time cabem na grade da folha 3', async ({ page, api }) => {
    await openScoresheet(
      page,
      api,
      knockoutGame('finished', { home_penalties: 30, away_penalties: 0, penaltyKicks: kicks(30) }),
    )

    const sheet = page.locator(SHEET).last()
    await expect(sheet.locator('[data-test=scoresheet-kick]')).toHaveCount(60)
    await expect(sheet.locator('[data-test=scoresheet-kick] .fill')).toHaveCount(30)
    await expectSheetsFit(page)
    const outside = await sheet.locator('[data-test=scoresheet-kick]').evaluateAll(
      (cells) =>
        cells.filter((cell) => {
          const box = cell.getBoundingClientRect()
          const mark = cell.querySelector('.mark')!.getBoundingClientRect()
          return mark.left < box.left || mark.right > box.right
        }).length,
    )
    expect(outside, 'marca fora da célula').toBe(0)
    expect(await pdfPages(page)).toEqual({ pages: 3, a4Landscape: true })
  })

  const LAYOUTS: [string, (size: number) => GameFixture, number][] = [
    ['típico em branco', (size) => fullRosters(game1('scheduled'), size), 2],
    ['típico preenchido', (size) => fullRosters(game1('finished'), size), 2],
    ['pior caso em branco', (size) => worstCaseGame('scheduled', size), 3],
    ['pior caso preenchido', (size) => worstCaseGame('finished', size), 2],
  ]

  for (const limit of [35, 30, 25, 20]) {
    for (const [name, build, pages] of LAYOUTS) {
      test(`${limit} linhas por time respeitam a área útil: ${name}`, async ({ page, api }) => {
        await openScoresheet(page, api, withLimit(build(limit), limit))

        const fit = await rosterFit(page)
        expect(fit.rows).toBe(limit)
        expect(fit.rowHeight).toBeCloseTo(Math.min(6.5, 130.9 / limit), 1)
        expect(fit.rowSpread, 'linhas com alturas diferentes').toBeLessThan(0.05)
        expect(fit.footBottom, 'rodapé além da área útil').toBeLessThanOrEqual(
          CONTENT_LIMIT_MM + 0.05,
        )
        expect(fit.footBottom, 'rodapé subiu').toBeGreaterThan(CONTENT_LIMIT_MM - 0.05)
        expect(fit.slack, 'folga menor que o mínimo').toBeGreaterThanOrEqual(MIN_SLACK_MM)
        expect(
          Math.max(fit.overflow, fit.overflowX),
          'conteúdo passou da folha',
        ).toBeLessThanOrEqual(0)
        expect(await pdfPages(page)).toEqual({ pages, a4Landscape: true })
      })
    }
  }

  test('limite menor que 20: linhas em 6,5 mm e rodapé no fim da folha', async ({ page, api }) => {
    await openScoresheet(page, api, withLimit(fullRosters(game1('scheduled'), 11), 11))

    const fit = await rosterFit(page)
    expect(fit.rows).toBe(11)
    expect(fit.rowHeight).toBeCloseTo(6.5, 1)
    expect(fit.footBottom).toBeGreaterThan(CONTENT_LIMIT_MM - 0.05)
    expect(fit.footBottom).toBeLessThanOrEqual(CONTENT_LIMIT_MM + 0.05)
    expect(fit.slack).toBeGreaterThan(50)
  })

  test('elenco acima do limite: continuação sem cortar atletas e aviso fora da impressão', async ({
    page,
    api,
  }) => {
    await openScoresheet(page, api, withLimit(largeRosterGame(23), 20))

    const sheets = page.locator(SHEET)
    await expect(sheets).toHaveCount(3)
    const first = sheets.first().locator('[data-test=scoresheet-roster-home]')
    await expect(first.locator('tbody tr')).toHaveCount(20)
    await expect(first).toContainText('Atleta 20')
    const continuation = sheets.nth(1).locator('[data-test=scoresheet-roster-home]')
    await expect(continuation.locator('tbody tr')).toHaveCount(20)
    await expect(continuation).toContainText('Atleta 23')

    const warning = page.locator('[data-test=scoresheet-roster-limit]')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('A liga permite 20 jogadores por time')
    await expect(warning).toContainText('Atlético Serrano tem 23 atletas')
    await page.emulateMedia({ media: 'print' })
    await expect(warning).toBeHidden()
    await page.emulateMedia({ media: 'screen' })
    await expectSheetsFit(page)
    expect(await pdfPages(page)).toEqual({ pages: 3, a4Landscape: true })
  })

  test('sem o campo na API: elenco pequeno mantém 35 linhas, com a mesma altura', async ({
    page,
    api,
  }) => {
    await openScoresheet(page, api, game1('scheduled'))

    const fit = await rosterFit(page)
    expect(fit.rows).toBe(35)
    expect(fit.rowSpread).toBeLessThan(0.05)
    expect(fit.slack).toBeGreaterThanOrEqual(MIN_SLACK_MM)
    await expect(
      page.locator(SHEET).first().locator('[data-test=scoresheet-roster-home] thead'),
    ).toContainText('Assinatura')
  })
})
