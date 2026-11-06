import { fixture } from './support/mock-api'
import { expect, test } from './support/test'

test.describe('Telas públicas', () => {
  test('home lista os campeonatos em destaque', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Campeonatos em destaque' })).toBeVisible()
    await expect(page.getByText('Copa Footfy')).toBeVisible()
  })

  test('lista de campeonatos', async ({ page }) => {
    await page.goto('/campeonatos')
    await expect(page.getByRole('heading', { name: 'Campeonatos', exact: true })).toBeVisible()
    await expect(page.getByText('Torneio de Verão')).toBeVisible()
  })

  test('detalhe do campeonato com as ligas', async ({ page }) => {
    await page.goto('/campeonatos/1')
    await expect(page.getByText('Copa Footfy')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ligas' })).toBeVisible()
    await expect(page.getByText('Série B')).toBeVisible()
  })

  test('liga com times, tabela e estatísticas', async ({ page }) => {
    await page.goto('/ligas/1')
    await expect(page.getByRole('heading', { name: 'Série A' })).toBeVisible()
    await expect(page.getByText('Atlético Serrano')).toBeVisible()

    await page.getByRole('tab', { name: 'Tabela' }).click()
    await expect(page.locator('[data-test=standings-row]')).toHaveCount(4)

    await page.getByRole('tab', { name: 'Estatísticas' }).click()
    await expect(page.locator('[data-test=top-scorers]')).toContainText('Lucas Ferreira')
  })

  test('aba Partidas lista as rodadas antes do mata-mata, com a fase e os pênaltis', async ({
    page,
    api,
  }) => {
    const body = fixture<{ data: { games: Record<string, unknown>[] } }>('public-league-1')
    const games = body.data.games
    body.data.games = [
      {
        ...games[0],
        id: 7,
        round: null,
        phase: 'Final',
        phase_order: 2,
        home_score: 2,
        away_score: 2,
        home_penalties: 4,
        away_penalties: 3,
      },
      ...games,
    ]
    api.on('GET', '/public/leagues/1', { body })

    await page.goto('/ligas/1?tab=partidas')
    const rows = page.locator('[data-test=public-games-table] tbody tr')
    await expect(rows).toHaveCount(7)
    await expect(page.locator('[data-test=public-games-table] thead')).toContainText('Etapa')
    await expect(rows.first().locator('td').first()).toHaveText('1ª rodada')
    await expect(rows.last().locator('td').nth(0)).toHaveText('Final')
    await expect(rows.last().locator('td').nth(2)).toHaveText('2 (4) × (3) 2')
  })

  test('tabela pública com 2 grupos mostra uma tabela por grupo', async ({ page, api }) => {
    const rows = fixture<{ data: { standings: { team_id: number }[] } }>('league-1-table').data
      .standings
    api.on('GET', '/public/leagues/1/table', {
      body: {
        data: {
          standings: rows,
          groups: [
            { group_number: 1, standings: rows.slice(0, 2) },
            { group_number: 2, standings: rows.slice(2) },
          ],
          tiebreakers: ['points', 'wins'],
        },
      },
    })

    await page.goto('/ligas/1?tab=tabela')
    await expect(page.locator('[data-test=standings-title]')).toHaveText(['Grupo A', 'Grupo B'])
    await expect(page.locator('[data-test=standings-row]')).toHaveCount(4)
    await expect(page.locator('[data-test=standings-tiebreakers]')).toHaveText(
      'Desempate: vitórias.',
    )
  })

  test('chave pública do mata-mata com a disputa de 3º lugar', async ({ page, api }) => {
    const league = fixture<{ data: Record<string, unknown> }>('public-league-1').data
    const team = (id: number, nickname: string, aggregate_score: number) => ({
      team_id: id,
      name: `${nickname} FC`,
      nickname,
      aggregate_score,
    })
    const leg = (
      id: number,
      home: number,
      away: number,
      score: [number, number],
      penalties?: [number, number],
    ) => ({
      id,
      leg: null,
      home_team_id: home,
      away_team_id: away,
      home_score: score[0],
      away_score: score[1],
      home_penalties: penalties?.[0] ?? null,
      away_penalties: penalties?.[1] ?? null,
      status: 'finished',
      match_date: null,
    })
    const decided = (
      key: string,
      winner: number,
      teams: ReturnType<typeof team>[],
      legs: ReturnType<typeof leg>[],
      decidedBy = 'aggregate',
    ) => ({
      tie_key: key,
      decided: true,
      winner_team_id: winner,
      decided_by: decidedBy,
      awaiting_penalties: false,
      decisive_game_id: legs[0].id,
      home_penalties: legs[0].home_penalties,
      away_penalties: legs[0].away_penalties,
      teams,
      legs,
    })
    api
      .on('GET', '/public/leagues/1', {
        body: {
          data: {
            ...league,
            format: 'hybrid',
            fixture_mode: 'draw',
            groups_count: 2,
            qualifiers_per_group: 2,
            knockout_size: 4,
            final_legs: 1,
            knockout_legs: 1,
            third_place: true,
          },
        },
      })
      .on('GET', '/public/leagues/1/table', {
        body: {
          data: {
            standings: [],
            groups: [],
            tiebreakers: ['points'],
            phases: [
              {
                phase: 'Semifinal',
                phase_order: 3,
                stage: 'SF',
                ties: [
                  decided(
                    'SF-1',
                    2,
                    [team(3, 'Estrela', 1), team(2, 'Ribeirinho', 1)],
                    [leg(201, 3, 2, [1, 1], [3, 4])],
                    'penalties',
                  ),
                  decided(
                    'SF-2',
                    4,
                    [team(4, 'União', 2), team(1, 'Serrano', 0)],
                    [leg(202, 4, 1, [2, 0])],
                  ),
                ],
              },
              {
                phase: 'Disputa de 3º lugar',
                phase_order: 4,
                stage: '3P',
                ties: [
                  decided(
                    '3P-1',
                    3,
                    [team(3, 'Estrela', 2), team(1, 'Serrano', 1)],
                    [leg(203, 3, 1, [2, 1])],
                  ),
                ],
              },
            ],
          },
        },
      })

    await page.goto('/ligas/1?tab=tabela')
    await expect(page.locator('[data-test=knockout-phase-title]')).toHaveText([
      'Semifinal',
      'Disputa de 3º lugar',
      'Final',
    ])
    await expect(page.locator('[data-test=knockout-tie-outcome]')).toHaveText([
      'Classificado: Ribeirinho nos pênaltis (4 × 3)',
      'Classificado: União',
      '3º lugar: Estrela',
    ])
    await expect(page.locator('[data-test=knockout-leg-score]').first()).toHaveText('1 (3) × (4) 1')
    const final = page.locator('[data-test=knockout-future-tie]')
    await expect(final).toHaveCount(1)
    await expect(final.locator('[data-test=knockout-future-home]')).toHaveText('Ribeirinho')
    await expect(final.locator('[data-test=knockout-future-away]')).toHaveText('União')
  })

  test('detalhe do time com o elenco', async ({ page }) => {
    await page.goto('/times/1')
    await expect(page.getByText('Atlético Serrano')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Lucas Ferreira' })).toBeVisible()

    await page.getByRole('tab', { name: 'Comissão Técnica' }).click()
    await expect(page.getByRole('cell', { name: 'Carlos Andrade' })).toBeVisible()
  })

  test('partida (placeholder): Voltar sem histórico vai para os campeonatos', async ({ page }) => {
    await page.goto('/partidas/1')
    await expect(page.getByText('Detalhes da partida em breve')).toBeVisible()

    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/campeonatos$/)
    await expect(page.getByText('Torneio de Verão')).toBeVisible()
  })

  test('login com CPF e senha leva à seleção de campeonato', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'CPF' }).fill('45047364895')
    await page.getByRole('textbox', { name: 'Senha' }).fill('123456')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/admin\/selecionar$/)
    await expect(page.getByRole('heading', { name: 'Escolha o campeonato' })).toBeVisible()
  })
})
