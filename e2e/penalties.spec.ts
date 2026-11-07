import type { Page } from '@playwright/test'
import { fixture, type MockApi } from './support/mock-api'
import { expect, MOBILE, openDialog, signIn, test } from './support/test'

type GameFixture = { data: Record<string, unknown> }

interface Kick {
  team_id: number
  player_id: number
  scored: boolean
}

const PLAYERS: Record<number, [string, number]> = {
  1: ['Rafael Souza', 1],
  2: ['Bruno Lima', 4],
  3: ['Diego Martins', 8],
  4: ['Lucas Ferreira', 9],
  5: ['Thiago Rocha', 11],
  6: ['Caio Almeida', 1],
  7: ['Felipe Nunes', 9],
  8: ['Gustavo Pires', 10],
}

const HOME_WINS: Kick[] = [
  { team_id: 1, player_id: 1, scored: true },
  { team_id: 2, player_id: 6, scored: false },
  { team_id: 1, player_id: 2, scored: true },
  { team_id: 2, player_id: 7, scored: false },
  { team_id: 1, player_id: 3, scored: true },
  { team_id: 2, player_id: 8, scored: false },
]

const SUDDEN_DEATH: Kick[] = [...'GGXGGGGG'].flatMap((home, index) => [
  { team_id: 1, player_id: [1, 2, 3, 4, 5][index % 5], scored: home === 'G' },
  { team_id: 2, player_id: [6, 7, 8][index % 3], scored: 'GGGXGGGX'[index] === 'G' },
])

function savedKicks(kicks: Kick[]) {
  return kicks.map((kick, index) => ({
    id: index + 1,
    order: index + 1,
    ...kick,
    player: {
      id: kick.player_id,
      name: PLAYERS[kick.player_id][0],
      number: PLAYERS[kick.player_id][1],
      removed: false,
    },
  }))
}

function knockoutGame(kicks: Kick[] = [], extra: Record<string, unknown> = {}): GameFixture {
  const game = fixture<GameFixture>('game-1')
  const home = kicks.filter((kick) => kick.team_id === 1 && kick.scored).length
  const away = kicks.filter((kick) => kick.team_id === 2 && kick.scored).length
  Object.assign(game.data, {
    round: null,
    phase: 'Final',
    phase_order: 4,
    tie_key: 'F1',
    leg: null,
    knockout_stage: 'F',
    home_score: 1,
    away_score: 1,
    penalties_allowed: true,
    penalties_possible: true,
    home_penalties: kicks.length ? home : null,
    away_penalties: kicks.length ? away : null,
    penaltyKicks: savedKicks(kicks),
    ...extra,
  })
  return game
}

async function openShootout(page: Page, api: MockApi, game: GameFixture) {
  api.on('GET', '/games/1', { body: game })
  await page.goto('/admin/liga/1/partidas/1?tab=sumula')
  await expect(page.locator('[data-test=game-penalties]')).toBeVisible()
}

async function typeKick(page: Page, index: number, number: number, scored: boolean) {
  await expect(page.locator(`[data-test=kick-player-${index}] input`)).toBeFocused()
  await page.keyboard.type(String(number))
  await page.keyboard.press('Tab')
  if (!scored) await page.keyboard.press('Tab')
  await expect(
    page
      .locator('[data-test=kick-row]')
      .nth(index)
      .locator(`[data-test=kick-${scored ? 'scored' : 'missed'}]`),
  ).toBeFocused()
  await page.keyboard.press('Enter')
}

async function typeKicks(page: Page, kicks: Kick[]) {
  for (const [index, kick] of kicks.entries()) {
    await typeKick(page, index, PLAYERS[kick.player_id][1], kick.scored)
  }
}

test.describe('Disputa de pênaltis', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('digitação pelo teclado: alterna os times, decide e salva a lista inteira', async ({
    page,
    api,
  }) => {
    let sent: { kicks: Kick[] } | null = null
    api.on('PUT', '/games/1/penalty-kicks', ({ request }) => {
      sent = request.postDataJSON() as { kicks: Kick[] }
      return { body: knockoutGame(sent.kicks) }
    })
    await openShootout(page, api, knockoutGame())

    await expect(page.locator('[data-test=shootout-kick]')).toHaveCount(10)
    await page.getByRole('radio', { name: 'Serrano (mandante)' }).check()
    await typeKick(page, 0, 1, true)
    await typeKick(page, 1, 1, false)
    await typeKick(page, 2, 4, true)
    await typeKick(page, 3, 9, false)
    await typeKick(page, 4, 8, true)
    await expect(page.locator('[data-test=shootout-result]')).toHaveText('Placar parcial: 3 × 0')
    await expect(page.locator('[data-test=game-penalties-save]')).toBeDisabled()
    await typeKick(page, 5, 10, false)

    const rows = page.locator('[data-test=kick-row]')
    await expect(rows).toHaveCount(6)
    await expect(rows.locator('[data-test=kick-team]')).toHaveText([
      'M · Serrano',
      'V · Ribeirinho',
      'M · Serrano',
      'V · Ribeirinho',
      'M · Serrano',
      'V · Ribeirinho',
    ])
    await expect(page.locator('[data-test=kick-add]')).toHaveCount(0)
    await expect(page.locator('[data-test=shootout-result]')).toHaveText(
      'Disputa decidida: 3 × 0, Serrano vence',
    )
    await expect(
      page.locator('[data-test=shootout-row-home] [data-test=shootout-kick] .num'),
    ).toHaveText(['1', '4', '8', '', ''])

    await page.locator('[data-test=game-penalties-save]').click()

    await expect(page.locator('.v-snackbar')).toContainText('Disputa de pênaltis salva.')
    expect(sent).toEqual({ kicks: HOME_WINS })
    await expect(page.locator('[data-test=game-score]')).toHaveText('1 (3) × (0) 1')
    await expect(page.locator('[data-test=game-penalties-save]')).toBeDisabled()
    await expect(page.locator('[data-test=game-penalties-clear]')).toBeVisible()
  })

  test('erro 422 do back aparece na tela', async ({ page, api }) => {
    api.allowConsoleError(/status of 422/)
    api.on('PUT', '/games/1/penalty-kicks', {
      status: 422,
      body: {
        message: 'Erro',
        errors: {
          kicks: ['O confronto não terminou empatado.'],
          'kicks.0.player_id': ['O jogador informado foi removido do elenco.'],
        },
      },
    })
    await openShootout(page, api, knockoutGame())
    await page.getByRole('radio', { name: 'Serrano (mandante)' }).check()
    await typeKicks(page, HOME_WINS)

    await page.locator('[data-test=game-penalties-save]').click()

    await expect(page.locator('[data-test=game-penalties-error]')).toHaveText(
      'O confronto não terminou empatado.',
    )
    await expect(page.locator('[data-test=kick-player-0]')).toContainText(
      'O jogador informado foi removido do elenco.',
    )
  })

  test('limpar pede confirmação na própria tela e envia a lista vazia', async ({ page, api }) => {
    let sent: unknown = null
    api.on('PUT', '/games/1/penalty-kicks', ({ request }) => {
      sent = request.postDataJSON()
      return { body: knockoutGame() }
    })
    await openShootout(page, api, knockoutGame(HOME_WINS))
    await expect(page.locator('[data-test=game-score]')).toHaveText('1 (3) × (0) 1')

    await page.locator('[data-test=game-penalties-clear]').click()
    await expect(page.locator('[data-test=game-penalties-confirm-clear]')).toContainText(
      'Apagar todas as cobranças',
    )
    await page.locator('[data-test=game-penalties-clear-confirm]').click()

    await expect(page.locator('.v-snackbar')).toContainText('Disputa de pênaltis removida.')
    expect(sent).toEqual({ kicks: [] })
    await expect(page.locator('[data-test=game-score]')).toHaveText('1 × 1')
    await expect(page.locator('[data-test=kick-row]')).toHaveCount(0)
  })

  test('fase seguinte gerada: disputa e gols travados, cartões liberados', async ({
    page,
    api,
  }) => {
    await openShootout(
      page,
      api,
      knockoutGame(HOME_WINS, {
        penalties_allowed: false,
        results_locked: true,
        results_lock: 'next_stage',
      }),
    )

    await expect(page.locator('[data-test=game-penalties-intro]')).toHaveText(
      'Disputa travada: a fase seguinte do mata-mata já foi gerada. Para corrigir, desfaça a fase seguinte.',
    )
    await expect(page.locator('[data-test=shootout-kick]')).toHaveCount(10)
    await expect(page.locator('[data-test=game-penalties-clear]')).toHaveCount(0)
    await expect(page.locator('[data-test=kick-row]')).toHaveCount(0)

    await expect(page.locator('[data-test=events-locked]')).toContainText(
      'a fase seguinte do mata-mata já foi gerada',
    )
    await expect(page.locator('[data-test=event-action]')).toHaveText([
      'Cartão amarelo',
      'Cartão vermelho',
    ])
    const rows = page.locator('[data-test=event-row]')
    await expect(rows).toHaveCount(4)
    await expect(page.locator('[data-test=event-delete]')).toHaveCount(1)
    await expect(rows.nth(1).locator('[data-test=event-delete]')).toBeVisible()

    await page.getByRole('button', { name: 'Cartão vermelho', exact: true }).click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=event-type]')).toContainText('Cartão vermelho')
    await dialog.locator('[data-test=event-type]').click()
    const options = page.locator('.v-menu.v-overlay--active [role=option]')
    await expect(options).toHaveCount(2)
    await expect(options).toContainText(['Cartão amarelo', 'Cartão vermelho'])
  })

  test('no desktop a grade com alternadas fica acima da lista, inteira e sem rolagem', async ({
    page,
    api,
  }) => {
    await openShootout(page, api, knockoutGame(SUDDEN_DEATH))

    const grid = page.locator('[data-test=shootout-grid]')
    await expect(grid.locator('[data-test=shootout-sudden-death]')).toHaveText('Alternadas')
    await expect(page.locator('[data-test=shootout-result]')).toHaveText(
      'Disputa decidida: 7 × 6, Serrano vence',
    )
    const gridBox = await grid.boundingBox()
    const listBox = await page.locator('[data-test=kick-row]').first().boundingBox()
    expect(gridBox!.y + gridBox!.height).toBeLessThan(listBox!.y)
    expect(gridBox!.width).toBeGreaterThanOrEqual(listBox!.width)
    expect(
      await grid
        .locator('[data-test=shootout-scroll]')
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(0)
    await expect(grid.locator('[data-test=shootout-scroll]')).not.toHaveClass(/hidden-right/)
    const totalLeft = (await grid.locator('.total-head').boundingBox())!.x
    const lastKick = (await grid.locator('[data-test=shootout-kick]').last().boundingBox())!
    const header = (await grid.locator('[data-test=shootout-sudden-death]').boundingBox())!
    expect(lastKick.x + lastKick.width).toBeLessThanOrEqual(totalLeft + 1)
    expect(header.x + header.width).toBeLessThanOrEqual(totalLeft + 1)
  })

  test('em 360px a grade rola e no fim nada fica sob o total fixo', async ({ page, api }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await openShootout(page, api, knockoutGame(SUDDEN_DEATH))

    const grid = page.locator('[data-test=shootout-grid]')
    const scroll = grid.locator('[data-test=shootout-scroll]')
    await expect(scroll).toHaveClass(/hidden-right/)
    await scroll.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    const totalLeft = (await grid.locator('.total-head').boundingBox())!.x
    const lastKick = (await grid.locator('[data-test=shootout-kick]').last().boundingBox())!
    const header = (await grid.locator('[data-test=shootout-sudden-death]').boundingBox())!
    expect(lastKick.x + lastKick.width).toBeLessThanOrEqual(totalLeft + 1)
    expect(header.x + header.width).toBeLessThanOrEqual(totalLeft + 1)
    await expect(scroll).toHaveClass(/hidden-left/)
    await expect(scroll).not.toHaveClass(/hidden-right/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })

  test('no celular a grade fica acima da lista e nada transborda', async ({ page, api }) => {
    await page.setViewportSize(MOBILE)
    await openShootout(page, api, knockoutGame(HOME_WINS))

    const grid = await page.locator('[data-test=shootout-grid]').boundingBox()
    const list = await page.locator('[data-test=kick-row]').first().boundingBox()
    expect(grid!.y).toBeLessThan(list!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      MOBILE.width,
    )
  })
})

test.describe('Partida pública', () => {
  test('mostra o placar e a grade das cobranças', async ({ page }) => {
    await page.goto('/partidas/1')

    await expect(page.locator('[data-test=public-game-score]')).toHaveText('1 × 1')
    await expect(page.locator('[data-test=public-game-penalties]')).toHaveText('Pênaltis 4 × 2')
    await expect(page.locator('[data-test=shootout-kick]')).toHaveCount(10)
    await expect(
      page.locator('[data-test=shootout-row-home] [data-test=shootout-first]'),
    ).toBeVisible()
    await expect(page.locator('[data-test=shootout-result]')).toHaveText(
      'Disputa decidida: 4 × 2, Serrano vence',
    )
  })
})
