import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LeagueDetailView from '@/views/public/leagues/LeagueDetailView.vue'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import { championshipA, createTestRouter, createTestVuetify, makeLeague } from '@/test/utils'
import { makeGame, makePage, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/publicLeagues.service', () => ({
  publicLeaguesService: { get: vi.fn(), games: vi.fn(), table: vi.fn(), statistics: vi.fn() },
}))

const serrano = makeTeam(1, 'Serrano')
const ribeirinho = makeTeam(2, 'Ribeirinho')

const league = makeLeague(1, championshipA, {
  format: 'hybrid',
  teams: [serrano, ribeirinho],
  stadiums: [],
  teams_count: 12,
  games_count: 66,
  stadiums_count: 3,
})

async function mountView(path = '/ligas/1') {
  const router = createTestRouter()
  await router.push(path)
  const wrapper = mount(LeagueDetailView, {
    props: { id: '1' },
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return wrapper
}

describe('LeagueDetailView público', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicLeaguesService.get).mockResolvedValue(league)
    vi.mocked(publicLeaguesService.games).mockResolvedValue(
      makePage(
        [
          makeGame(13, { round: 1, homeTeam: serrano, awayTeam: ribeirinho }),
          makeGame(11, { round: 2, homeTeam: ribeirinho, awayTeam: serrano }),
        ],
        { total: 66, last_page: 4 },
      ),
    )
  })

  it('mostra os contadores vindos do back, sem contar as listas do payload', async () => {
    const wrapper = await mountView()

    const tiles = wrapper
      .find('[data-test=league-counts]')
      .findAll('.v-card')
      .map((tile) => tile.text())
    expect(tiles).toEqual(['12Times', '66Partidas', '3Estádios'])
  })

  it('não busca as partidas antes de abrir a aba Partidas', async () => {
    const wrapper = await mountView()

    expect(publicLeaguesService.games).not.toHaveBeenCalled()

    await wrapper.find('[data-test=tab-partidas]').trigger('click')
    await flushPromises()

    expect(publicLeaguesService.games).toHaveBeenCalledOnce()
    expect(publicLeaguesService.games).toHaveBeenCalledWith('1', { page: 1, per_page: 20 })
  })

  it('aba Partidas lista a página do back com mandante e visitante do jogo', async () => {
    const wrapper = await mountView('/ligas/1?tab=partidas')

    const rows = wrapper
      .find('[data-test=public-games-table]')
      .findAll('tbody tr')
      .map((row) => row.findAll('td').map((cell) => cell.text()))
    expect(rows.map((cells) => cells.slice(0, 4))).toEqual([
      ['1ª rodada', 'Serrano', '— × —', 'Ribeirinho'],
      ['2ª rodada', 'Ribeirinho', '— × —', 'Serrano'],
    ])
    expect(wrapper.find('[data-test=public-games-pagination]').exists()).toBe(true)
  })
})
