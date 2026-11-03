import { fixture, type MockApi } from './mock-api'

const json = (name: string) => () => ({ body: fixture(name) })

interface GameEventsBody {
  data: { game_id: number }[]
}

/** Respostas padrão da API (liga 1 "Série A" com dados; demais ids sem mock). */
export function registerDefaultRoutes(api: MockApi) {
  api
    // Auth e conta
    .on('POST', '/login', json('login-master'))
    .on('POST', '/logout', { body: { message: 'Logout realizado' } })
    .on('GET', '/me', json('me'))

    // Públicas
    .on('GET', '/public/championships', json('public-championships'))
    .on('GET', '/public/championships/1', json('public-championship-1'))
    .on('GET', '/public/leagues/1', json('public-league-1'))
    .on('GET', '/public/leagues/1/table', json('league-1-table'))
    .on('GET', '/public/leagues/1/statistics', json('league-1-statistics'))
    .on('GET', '/public/teams/1', json('public-team-1'))

    // Contexto de liga e campeonatos
    .on('GET', '/leagues', json('leagues'))
    .on('GET', '/championships', json('championships'))
    .on('GET', '/championships/1', json('championship-1'))

    // Liga 1
    .on('GET', '/leagues/1/dashboard', json('league-1-dashboard'))
    .on('GET', '/leagues/1/table', json('league-1-table'))
    .on('GET', '/leagues/1/statistics', json('league-1-statistics'))
    .on('GET', '/teams', json('teams'))
    .on('GET', /^\/teams\/(\d+)$/, ({ params }) => ({ body: fixture(`team-${params[0]}`) }))
    .on('GET', '/players', json('players'))
    .on('GET', '/players/positions', json('players-positions'))
    .on('GET', /^\/players\/(\d+)$/, ({ params }) => ({ body: fixture(`player-${params[0]}`) }))
    .on('GET', '/technical-committee-members/roles', json('technical-committee-members-roles'))
    .on('GET', /^\/technical-committee-members\/(\d+)$/, ({ params }) => ({
      body: fixture(`technical-committee-member-${params[0]}`),
    }))
    .on('GET', '/stadiums', json('stadiums'))
    .on('GET', '/games', json('games'))
    .on('GET', '/games/1', json('game-1'))
    .on('GET', '/game-events', ({ url }) => {
      const body = fixture<GameEventsBody>('game-events')
      const gameId = url.searchParams.get('game_id')
      if (gameId) body.data = body.data.filter((event) => event.game_id === Number(gameId))
      return { body }
    })
    .on('GET', '/users', json('users'))
}
