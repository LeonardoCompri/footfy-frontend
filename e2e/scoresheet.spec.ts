import type { Page } from '@playwright/test'
import { fixture, type MockApi } from './support/mock-api'
import { expect, signIn, test } from './support/test'

type GameFixture = { data: Record<string, unknown> & { homeTeam: { players: unknown[] } } }

const SHEET = '[data-test=scoresheet-sheet]'

function knockoutGame(): GameFixture {
  const game = fixture<GameFixture>('game-1')
  Object.assign(game.data, {
    round: null,
    phase: 'Final',
    phase_order: 4,
    tie_key: 'F1',
    leg: null,
    knockout_stage: 'F',
    penalties_possible: true,
  })
  return game
}

function largeRosterGame(size: number): GameFixture {
  const game = fixture<GameFixture>('game-1')
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
        footBelow: Math.round(foot.bottom - box.bottom),
      }
    }),
  )
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
  test('pontos corridos: o botão da partida abre 2 folhas A4 paisagem', async ({ page }) => {
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
    await expect(page.locator('[data-test=scoresheet-knockout-tag]')).toHaveCount(0)
    await expect(sheets.first().locator('[data-test=scoresheet-competition]')).toHaveText(
      'Copa Footfy›Série A',
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
    await expect(home.locator('tbody tr')).toHaveCount(17)

    await expect(page.locator('[data-test=scoresheet-legend-type]')).toHaveText([
      'G Gol',
      'GC Gol contra',
      'CA Cartão amarelo',
      'CV Cartão vermelho',
    ])
    await expect(page.locator('[data-test=scoresheet-event-row]')).toHaveCount(18)

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
    await expect(penalties.locator('[data-test=scoresheet-knockout-tag]')).toHaveText(
      'Somente mata-mata',
    )
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

  test('elenco de 17 atletas cabe numa folha só da relação', async ({ page, api }) => {
    await openScoresheet(page, api, largeRosterGame(17))

    await expect(page.locator(SHEET)).toHaveCount(2)
    const home = page.locator(SHEET).first().locator('[data-test=scoresheet-roster-home]')
    await expect(home.locator('[data-test=scoresheet-player]')).toHaveCount(17)
    await expect(home.locator('[data-test=scoresheet-blank]')).toHaveCount(0)
    await expect(home).toContainText('Atleta 17')
    for (const sheet of await sheetsOverflow(page)) {
      expect(sheet.overflow).toBeLessThanOrEqual(0)
    }
    expect((await pdfPages(page)).pages).toBe(2)
  })

  test('elenco acima de 17 atletas ganha uma folha extra da relação', async ({ page, api }) => {
    await openScoresheet(page, api, largeRosterGame(20))

    await expect(page.locator(SHEET)).toHaveCount(3)
    await expect(page.locator('[data-test=scoresheet-page]')).toHaveText([
      'Pág. 1 de 3',
      'Pág. 2 de 3',
      'Pág. 3 de 3',
    ])
    const continuation = page.locator(SHEET).nth(1)
    await expect(continuation).toContainText('Relação de atletas (continuação)')
    await expect(continuation.locator('[data-test=scoresheet-roster-home]')).toContainText(
      'Atleta 18',
    )
    await expect(continuation.locator('[data-test=scoresheet-match]')).toHaveCount(0)
    for (const sheet of await sheetsOverflow(page)) {
      expect(sheet.overflow).toBeLessThanOrEqual(0)
    }
    expect((await pdfPages(page)).pages).toBe(3)
  })
})
