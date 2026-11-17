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
    await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(0)
  })

  test('lista de campeonatos: Carregar mais acumula e a busca reinicia na página 1', async ({
    page,
    api,
  }) => {
    const [copa, verao] = fixture<{ data: Record<string, unknown>[] }>('public-championships').data
    const serra = { ...copa, id: 3, name: 'Liga da Serra' }
    const reply = (data: unknown[], current_page: number, last_page: number) => ({
      body: { data, meta: { current_page, per_page: 12, total: 3, last_page } },
    })
    api.on('GET', '/public/championships', ({ url }) => {
      if (url.searchParams.get('search')) return reply([verao], 1, 1)
      return url.searchParams.get('page') === '2'
        ? reply([serra], 2, 2)
        : reply([copa, verao], 1, 2)
    })
    const championshipsRequest = (params: Record<string, string>) =>
      page.waitForRequest((request) => {
        const url = new URL(request.url())
        return (
          request.method() === 'GET' &&
          url.pathname.endsWith('/public/championships') &&
          JSON.stringify(Object.fromEntries(url.searchParams)) === JSON.stringify(params)
        )
      })
    const titles = page.locator('.v-card-title')

    const firstPage = championshipsRequest({ page: '1', per_page: '12' })
    await page.goto('/campeonatos')
    await firstPage
    await expect(titles).toHaveText(['Copa Footfy', 'Torneio de Verão'])

    const secondPage = championshipsRequest({ page: '2', per_page: '12' })
    await page.getByRole('button', { name: 'Carregar mais' }).click()
    await secondPage
    await expect(titles).toHaveText(['Copa Footfy', 'Torneio de Verão', 'Liga da Serra'])
    await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(0)

    const search = championshipsRequest({ search: 'verão', page: '1', per_page: '12' })
    await page.getByRole('textbox', { name: 'Buscar campeonato' }).fill('verão')
    await search
    await expect(titles).toHaveText(['Torneio de Verão'])
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
    await expect(page.locator('[data-test=league-counts] .v-card')).toHaveText([
      /4\s*Times/,
      /6\s*Partidas/,
      /2\s*Estádios/,
    ])

    await page.getByRole('tab', { name: 'Tabela' }).click()
    await expect(page.locator('[data-test=standings-row]')).toHaveCount(4)

    await page.getByRole('tab', { name: 'Estatísticas' }).click()
    await expect(page.locator('[data-test=top-scorers]')).toContainText('Lucas Ferreira')
  })

  test('aba Partidas carrega só ao abrir, pagina no servidor e mostra a fase e os pênaltis', async ({
    page,
    api,
  }) => {
    const games = fixture<{ data: Record<string, unknown>[] }>('public-league-1-games').data
    const final = {
      ...games[0],
      id: 7,
      round: null,
      phase: 'Final',
      phase_order: 2,
      home_score: 2,
      away_score: 2,
      home_penalties: 4,
      away_penalties: 3,
    }
    const meta = (current_page: number) => ({ current_page, per_page: 20, total: 7, last_page: 2 })
    api.on('GET', '/public/leagues/1/games', ({ url }) =>
      url.searchParams.get('page') === '2'
        ? { body: { data: [final], meta: meta(2) } }
        : { body: { data: games, meta: meta(1) } },
    )
    const gamesRequests: Record<string, string>[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (request.method() === 'GET' && url.pathname.endsWith('/public/leagues/1/games')) {
        gamesRequests.push(Object.fromEntries(url.searchParams))
      }
    })

    await page.goto('/ligas/1')
    await expect(page.getByText('Atlético Serrano')).toBeVisible()
    expect(gamesRequests).toEqual([])

    await page.getByRole('tab', { name: 'Partidas' }).click()
    const rows = page.locator('[data-test=public-games-table] tbody tr')
    await expect(rows).toHaveCount(6)
    await expect(page.locator('[data-test=public-games-table] thead')).toContainText('Etapa')
    await expect(rows.first().locator('td').nth(0)).toHaveText('1ª rodada')
    await expect(rows.first().locator('td').nth(1)).toHaveText('Atlético Serrano')
    await expect(rows.first().locator('td').nth(3)).toHaveText('Clube Ribeirinho')
    expect(gamesRequests).toEqual([{ page: '1', per_page: '20' }])

    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first().locator('td').nth(0)).toHaveText('Final')
    await expect(rows.first().locator('td').nth(2)).toHaveText('2 (4) × (3) 2')
    expect(gamesRequests).toEqual([
      { page: '1', per_page: '20' },
      { page: '2', per_page: '20' },
    ])
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

  test('partida: Voltar sem histórico vai para os campeonatos', async ({ page }) => {
    await page.goto('/partidas/1')
    await expect(page.locator('[data-test=public-game-home]')).toHaveText('Serrano')

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
