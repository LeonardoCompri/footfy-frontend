import { fixture, type MockApi } from './mock-api'

const json = (name: string) => () => ({ body: fixture(name) })

const listOrPage =
  (name: string) =>
  ({ url }: { url: URL }) => {
    const body = fixture<{ data: { name: string }[] }>(name)
    if (!url.searchParams.has('page')) return { body }
    const search = url.searchParams.get('search')?.toLocaleLowerCase('pt-BR')
    const data = search
      ? body.data.filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(search))
      : body.data
    const perPage = Number(url.searchParams.get('per_page') ?? 20)
    return {
      body: {
        data,
        meta: { current_page: 1, per_page: perPage, total: data.length, last_page: 1 },
      },
    }
  }

export function registerDefaultRoutes(api: MockApi) {
  api
    .on('POST', '/login', json('login-master'))
    .on('POST', '/logout', { body: { message: 'Logout realizado' } })
    .on('GET', '/me', json('me'))

    .on('GET', '/public/championships', ({ url }) => ({
      body: fixture(
        url.searchParams.has('page') ? 'public-championships-paginated' : 'public-championships',
      ),
    }))
    .on('GET', '/public/championships/1', json('public-championship-1'))
    .on('GET', '/public/leagues/1', json('public-league-1'))
    .on('GET', '/public/leagues/1/games', json('public-league-1-games'))
    .on('GET', '/public/leagues/1/table', json('league-1-table'))
    .on('GET', '/public/leagues/1/statistics', json('league-1-statistics'))
    .on('GET', '/public/teams/1', json('public-team-1'))
    .on('GET', '/public/games/1', json('public-game-1'))

    .on('GET', '/leagues', json('leagues'))
    .on('GET', '/championships', json('championships'))
    .on('GET', '/championships/1', json('championship-1'))

    .on('GET', '/leagues/1', json('league-1'))
    .on('GET', '/leagues/1/groups', json('league-1-groups'))
    .on('GET', '/leagues/1/draw', json('league-1-draw'))
    .on('GET', '/leagues/1/knockout', json('league-1-knockout'))
    .on('GET', '/leagues/1/dashboard', json('league-1-dashboard'))
    .on('GET', '/leagues/1/table', json('league-1-table'))
    .on('GET', '/leagues/1/statistics', json('league-1-statistics'))
    .on('GET', '/teams', listOrPage('teams'))
    .on('GET', /^\/teams\/(\d+)$/, ({ params }) => ({ body: fixture(`team-${params[0]}`) }))
    .on('GET', '/players', listOrPage('players'))
    .on('GET', '/players/positions', json('players-positions'))
    .on('GET', /^\/players\/(\d+)$/, ({ params }) => ({ body: fixture(`player-${params[0]}`) }))
    .on('GET', '/technical-committee-members/roles', json('technical-committee-members-roles'))
    .on('GET', /^\/technical-committee-members\/(\d+)$/, ({ params }) => ({
      body: fixture(`technical-committee-member-${params[0]}`),
    }))
    .on('GET', '/stadiums', json('stadiums'))
    .on('GET', '/games', json('games'))
    .on('GET', '/games/1', json('game-1'))
    .on('GET', '/game-events', json('game-events'))
    .on('GET', '/event-types', json('event-types'))
    .on('GET', '/users', listOrPage('users'))
}
