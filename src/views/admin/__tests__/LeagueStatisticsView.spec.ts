import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LeagueStatisticsView from '@/views/admin/leagues/LeagueStatisticsView.vue'
import { leaguesService } from '@/services/api/leagues.service'
import type { LeagueStatistics } from '@/types/leagueStats'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), statistics: vi.fn() },
}))

const player = (id: number, name: string, team: string | null) => ({
  player_id: id,
  player_name: name,
  player_removed: false,
  team_id: team ? 1 : null,
  team_name: team ? `${team} FC` : null,
  team_nickname: team,
})

const stats: LeagueStatistics = {
  top_scorers: [
    { ...player(1, 'Renato', 'Vitória'), goals: 5 },
    { ...player(2, 'Everaldo', 'Bahia'), goals: 3 },
  ],
  top_assists: [{ ...player(3, 'Matheuzinho', 'Vitória'), assists: 4 }],
  top_cards: [{ ...player(4, 'Zé Hugo', null), yellow_cards: 2, red_cards: 1, total_cards: 3 }],
  goals_by_bucket: [
    { type: 'round', round: 1, phase: null, phase_order: null, goals: 6 },
    { type: 'round', round: 2, phase: null, phase_order: null, goals: 4 },
  ],
  results_split: { home_wins: 2, draws: 1, away_wins: 1 },
  cards_split: { yellow: 7, red: 2 },
  // Diverge de propósito da soma dos buckets (10) e do split (4): os tiles devem usar `totals`.
  totals: { goals: 12, finished_games: 5, goals_average: 2.4 },
}

async function mountView(data: LeagueStatistics = stats) {
  setupLeagueSession(makeUser('coach'), [makeLeague(7, championshipA)])
  vi.mocked(leaguesService.statistics).mockResolvedValue(data)
  const router = createTestRouter()
  await router.push('/admin/liga/7/estatisticas')
  const wrapper = mount(LeagueStatisticsView, { global: { plugins: [createTestVuetify(), router] } })
  await flushPromises()
  return wrapper
}

function tileTexts(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper
    .find('[data-test="league-stat-tiles"]')
    .findAll('.v-card')
    .map((card) => card.text())
}

describe('LeagueStatisticsView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('consome GET /leagues/{id}/statistics e mostra os rankings', async () => {
    const wrapper = await mountView()

    expect(leaguesService.statistics).toHaveBeenCalledWith(7)
    const scorers = wrapper.find('[data-test="top-scorers"]').findAll('[data-test="ranking-row"]')
    expect(scorers.map((r) => r.text())).toEqual(['1RenatoVitória5', '2EveraldoBahia3'])
    expect(wrapper.find('[data-test="top-assists"]').text()).toContain('Matheuzinho')
    const cards = wrapper.find('[data-test="top-cards"]').find('[data-test="ranking-row"]').text()
    expect(cards).toBe('1Zé HugoSem time213')
  })

  it('totais vêm de `totals` da API e gráficos da liga (reaproveitados do Dashboard)', async () => {
    const wrapper = await mountView()

    expect(tileTexts(wrapper)).toEqual([
      '12Gols',
      '5Partidas finalizadas',
      '2,4Média de gols',
      '7Cartões amarelos',
      '2Cartões vermelhos',
    ])
    expect(wrapper.findAll('[data-test="goals-bar"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="results-split"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="cards-chart"]').exists()).toBe(true)
  })

  it('sem cards_split (backend antes da FOOT-0031) omite totais e gráfico de cartões', async () => {
    const withoutCards = { ...stats }
    delete withoutCards.cards_split
    const wrapper = await mountView(withoutCards)

    expect(wrapper.find('[data-test="league-stat-tiles"]').text()).not.toContain('Cartões')
    expect(wrapper.find('[data-test="cards-chart"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="top-cards"]').exists()).toBe(true)
  })

  it('liga sem eventos mostra estados vazios', async () => {
    const wrapper = await mountView({
      top_scorers: [],
      top_assists: [],
      top_cards: [],
      goals_by_bucket: [],
      results_split: { home_wins: 0, draws: 0, away_wins: 0 },
      totals: { goals: 0, finished_games: 0, goals_average: null },
    })

    expect(wrapper.text()).toContain('Nenhum gol registrado ainda.')
    expect(tileTexts(wrapper)).toEqual(['0Gols', '0Partidas finalizadas', '—Média de gols'])
  })

  it('média de gols com uma casa decimal no formato pt-BR', async () => {
    const wrapper = await mountView({
      ...stats,
      totals: { goals: 4, finished_games: 3, goals_average: 1.33 },
    })

    expect(tileTexts(wrapper)).toContain('1,3Média de gols')
  })
})
