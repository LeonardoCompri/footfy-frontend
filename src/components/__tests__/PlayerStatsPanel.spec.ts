import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PlayerStatsPanel from '@/components/players/PlayerStatsPanel.vue'
import { eventTypesService } from '@/services/api/eventTypes.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { createTestVuetify } from '@/test/utils'
import { defaultEventTypes, makeEvent } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { listAll: vi.fn() },
}))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))

async function mountPanel() {
  const wrapper = mount(PlayerStatsPanel, {
    props: { playerId: 10, leagueId: 7 },
    global: { plugins: [createTestVuetify()] },
  })
  await flushPromises()
  return wrapper
}

describe('PlayerStatsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(eventTypesService.list).mockResolvedValue(defaultEventTypes())
  })

  it('pede ao servidor só os eventos do jogador na liga', async () => {
    vi.mocked(gameEventsService.listAll).mockResolvedValue([])

    await mountPanel()

    expect(gameEventsService.listAll).toHaveBeenCalledWith({ league_id: 7, player_id: 10 })
  })

  it('conta gols, assistências e cartões só da liga, mesmo se o back devolver outras ligas', async () => {
    vi.mocked(gameEventsService.listAll).mockResolvedValue([
      makeEvent(1, { league_id: 7, player_id: 10 }),
      makeEvent(2, { league_id: 7, player_id: 20, related_player_id: 10 }),
      makeEvent(3, { league_id: 7, player_id: 10, type: 'red_card' }),
      makeEvent(4, { league_id: 9, player_id: 10 }),
      makeEvent(5, { league_id: 9, player_id: 10, type: 'yellow_card' }),
    ])

    const wrapper = await mountPanel()

    const tiles = wrapper.findAll('[data-test="player-stats"] .v-card').map((c) => c.text())
    expect(tiles).toEqual(['1Gols', '1Assistências', '0Cartões amarelos', '1Cartões vermelhos'])
  })
})
