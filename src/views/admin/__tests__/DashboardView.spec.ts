import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '@/views/admin/DashboardView.vue'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { leaguesService } from '@/services/api/leagues.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import type { GameEvent } from '@/types/gameEvent'
import type { LeagueDashboard } from '@/types/dashboard'
import { championshipA, createTestRouter, createTestVuetify, makeLeague } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), dashboard: vi.fn() },
}))
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { list: vi.fn() },
}))

const team = (id: number, nickname: string) => ({ id, name: `${nickname} FC`, nickname, logo: null })

const dashboardData: LeagueDashboard = {
  counters: { teams: 6, games: 12, stadiums: 3, season: '2026' },
  last_results: [
    {
      id: 10,
      home_team: team(1, 'Vitória'),
      away_team: team(2, 'Atlético'),
      home_score: 2,
      away_score: 1,
      status: 'finished',
      match_date: '2026-04-05 16:00:00',
      round: 1,
      phase: null,
    },
  ],
  upcoming_games: [],
  goals_by_bucket: [
    { type: 'round', round: 1, phase: null, phase_order: null, goals: 3 },
    { type: 'round', round: 2, phase: null, phase_order: null, goals: 5 },
    { type: 'phase', round: null, phase: 'Final', phase_order: 1, goals: 2 },
  ],
  results_split: { home_wins: 4, draws: 2, away_wins: 1 },
}

function cardEvent(id: number, leagueId: number, type: GameEvent['type']): GameEvent {
  return {
    id,
    game_id: 1,
    team_id: 1,
    player_id: 1,
    related_player_id: null,
    league_id: leagueId,
    type,
    minute: 10,
    created_at: '',
    updated_at: '',
  }
}

async function mountDashboard() {
  const context = useLeagueContextStore()
  context.leagues = [makeLeague(1, championshipA, { name: 'Série A', organizer: 'CBF' })]
  context.loaded = true
  context.setActiveLeague(1)

  const router = createTestRouter()
  await router.push('/admin/liga/1')
  const wrapper = mount(DashboardView, { global: { plugins: [createTestVuetify(), router] } })
  await flushPromises()
  return wrapper
}

describe('DashboardView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(leaguesService.dashboard).mockReset().mockResolvedValue(dashboardData)
    vi.mocked(gameEventsService.list)
      .mockReset()
      .mockImplementation(async (params) =>
        params?.type === 'yellow_card'
          ? [cardEvent(1, 1, 'yellow_card'), cardEvent(2, 1, 'yellow_card'), cardEvent(3, 9, 'yellow_card')]
          : [cardEvent(4, 1, 'red_card'), cardEvent(5, 9, 'red_card'), cardEvent(6, 9, 'red_card')],
      )
  })

  it('busca o Dashboard da liga ativa e mostra cabeçalho e contadores', async () => {
    const wrapper = await mountDashboard()

    expect(leaguesService.dashboard).toHaveBeenCalledWith(1)
    const header = wrapper.find('[data-test="dashboard-header"]').text()
    expect(header).toContain('Série A')
    expect(header).toContain('Brasileiro')
    expect(header).toContain('Organizado por CBF')

    const counters = wrapper.findAll('[data-test="dashboard-counter"]').map((c) => c.text())
    expect(counters).toEqual(['6Times', '12Partidas', '3Estádios', '2026Temporada'])
  })

  it('renderiza os 3 gráficos com os dados da liga', async () => {
    const wrapper = await mountDashboard()

    // Gols por rodada/fase: uma barra por bucket, título conforme o tipo de bucket.
    expect(wrapper.text()).toContain('Gols por rodada/fase')
    const bars = wrapper.findAll('[data-test="goals-bar"]')
    expect(bars).toHaveLength(3)
    expect(bars.map((b) => b.findAll('text')[1].text())).toEqual(['R1', 'R2', 'Final'])
    expect(bars[0].element.namespaceURI).toBe('http://www.w3.org/2000/svg')

    // Resultados: mandante × empate × visitante com valores e percentuais visíveis.
    const split = wrapper.find('[data-test="results-split"]')
    expect(wrapper.findAll('[data-test="results-segment"]')).toHaveLength(3)
    expect(split.text()).toContain('Mandante4(57%)')
    expect(split.text()).toContain('Empate2(29%)')
    expect(split.text()).toContain('Visitante1(14%)')

    // Cartões: só os eventos da liga ativa contam (league_id 9 é de outra liga).
    const cardRows = wrapper.findAll('[data-test="cards-row"]').map((r) => r.text())
    expect(cardRows[0]).toContain('Amarelos')
    expect(cardRows[0]).toMatch(/2$/)
    expect(cardRows[1]).toContain('Vermelhos')
    expect(cardRows[1]).toMatch(/1$/)
  })

  it('lista últimos resultados e o estado vazio das próximas partidas', async () => {
    const wrapper = await mountDashboard()

    const games = wrapper.findAll('[data-test="mini-game"]')
    expect(games).toHaveLength(1)
    expect(games[0].text()).toContain('Vitória')
    expect(games[0].text()).toContain('2 × 1')
    expect(wrapper.text()).toContain('Nenhuma partida agendada.')
  })

  it('reaproveita o último Dashboard da liga e revalida em segundo plano', async () => {
    await mountDashboard()
    const cached = useLeagueContextStore().dashboardCache.get(1)
    expect(cached?.dashboard.counters.teams).toBe(6)
    expect(cached?.cards).toEqual({ yellow: 2, red: 1 })
  })

  it('mostra a mensagem do backend quando o Dashboard falha', async () => {
    vi.mocked(leaguesService.dashboard).mockRejectedValueOnce({
      response: { data: { message: 'Você não tem acesso a este recurso.' } },
    })

    const wrapper = await mountDashboard()

    expect(wrapper.text()).toContain('Você não tem acesso a este recurso.')
    expect(wrapper.find('[data-test="goals-chart"]').exists()).toBe(false)
  })
})
