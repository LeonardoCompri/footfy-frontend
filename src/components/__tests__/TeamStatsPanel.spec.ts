import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamStatsPanel from '@/components/teams/TeamStatsPanel.vue'
import { eventTypesService } from '@/services/api/eventTypes.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { gamesService } from '@/services/api/games.service'
import { createTestVuetify } from '@/test/utils'
import { defaultEventTypes, makeEvent, makeGame, makePlayer } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({ gamesService: { listAll: vi.fn() } }))
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { listAll: vi.fn() },
}))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))

const players = [makePlayer(10, 'Atacante', { team_id: 5 }), makePlayer(11, 'Meia', { team_id: 5 })]

async function mountPanel() {
  const wrapper = mount(TeamStatsPanel, {
    props: { teamId: 5, leagueId: 7, players },
    global: { plugins: [createTestVuetify()] },
  })
  await flushPromises()
  return wrapper
}

describe('TeamStatsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(eventTypesService.list).mockResolvedValue(defaultEventTypes())
    vi.mocked(gamesService.listAll).mockResolvedValue([
      makeGame(1, {
        home_team_id: 5,
        away_team_id: 8,
        home_score: 2,
        away_score: 1,
        status: 'finished',
      }),
    ])
  })

  it('pede ao servidor só os eventos do time na liga', async () => {
    vi.mocked(gameEventsService.listAll).mockResolvedValue([])

    await mountPanel()

    expect(gameEventsService.listAll).toHaveBeenCalledWith({ league_id: 7, team_id: 5 })
  })

  it('mantém o filtro por liga no cliente quando o back devolve eventos de outras ligas', async () => {
    vi.mocked(gameEventsService.listAll).mockResolvedValue([
      makeEvent(1, { league_id: 7, team_id: 5, player_id: 10, related_player_id: 11 }),
      makeEvent(2, { league_id: 7, team_id: 5, player_id: 10 }),
      makeEvent(3, { league_id: 9, team_id: 5, player_id: 11 }),
      makeEvent(4, { league_id: 9, team_id: 5, player_id: 10, type: 'yellow_card' }),
      makeEvent(5, { league_id: 7, team_id: 5, player_id: 11, type: 'yellow_card' }),
    ])

    const wrapper = await mountPanel()

    const tiles = wrapper.findAll('[data-test="team-stats"] .v-card').map((c) => c.text())
    expect(tiles).toContain('1Cartões amarelos')
    const scorers = wrapper.findAll('table tbody tr').map((r) => r.text())
    expect(scorers).toEqual(['Atacante20', 'Meia01'])
  })

  it('mostra o erro quando a busca de eventos falha', async () => {
    vi.mocked(gameEventsService.listAll).mockRejectedValue(new Error('falhou'))

    const wrapper = await mountPanel()

    expect(wrapper.find('.v-alert').exists()).toBe(true)
    expect(wrapper.find('[data-test="team-stats"]').exists()).toBe(false)
  })
})
