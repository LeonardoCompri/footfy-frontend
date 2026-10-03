import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LeagueTableView from '@/views/admin/leagues/LeagueTableView.vue'
import LeagueDetailView from '@/views/public/leagues/LeagueDetailView.vue'
import LeagueTablePanel from '@/components/leagues/LeagueTablePanel.vue'
import { leaguesService } from '@/services/api/leagues.service'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import type { LeagueFormat } from '@/types/championship'
import type { KnockoutPhase, LeagueTable, StandingRow } from '@/types/leagueStats'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), table: vi.fn() },
}))
vi.mock('@/services/api/publicLeagues.service', () => ({
  publicLeaguesService: { get: vi.fn(), table: vi.fn(), statistics: vi.fn() },
}))

function standing(teamId: number, name: string, points: number): StandingRow {
  return {
    team_id: teamId,
    team: { id: teamId, name: `${name} FC`, nickname: name, logo: null },
    played: 3,
    wins: points / 3,
    draws: 0,
    losses: 3 - points / 3,
    goals_for: 5,
    goals_against: 2,
    goal_difference: 3,
    points,
  }
}

const phases: KnockoutPhase[] = [
  {
    phase: 'Semifinal',
    phase_order: 1,
    ties: [
      {
        tie_key: 'SF1',
        decided: true,
        winner_team_id: 1,
        teams: [
          { team_id: 1, name: 'Vitória FC', nickname: 'Vitória', aggregate_score: 3 },
          { team_id: 2, name: 'Bahia FC', nickname: 'Bahia', aggregate_score: 1 },
        ],
        legs: [
          { id: 10, leg: 1, home_team_id: 1, away_team_id: 2, home_score: 2, away_score: 0, status: 'finished', match_date: null },
          { id: 11, leg: 2, home_team_id: 2, away_team_id: 1, home_score: 1, away_score: 1, status: 'finished', match_date: null },
        ],
      },
      {
        tie_key: 'SF2',
        decided: false,
        winner_team_id: null,
        teams: [
          { team_id: 3, name: 'Sport FC', nickname: 'Sport', aggregate_score: 0 },
          { team_id: 4, name: 'Náutico FC', nickname: 'Náutico', aggregate_score: 0 },
        ],
        legs: [
          {
            id: 12,
            leg: null,
            home_team_id: 3,
            away_team_id: 4,
            home_score: null,
            away_score: null,
            status: 'scheduled',
            match_date: '2026-05-10 16:00:00',
          },
        ],
      },
    ],
  },
]

const TABLES: Record<LeagueFormat, LeagueTable> = {
  round_robin: { standings: [standing(1, 'Vitória', 9), standing(2, 'Bahia', 6)] },
  knockout: { phases },
  hybrid: { standings: [standing(1, 'Vitória', 9)], phases },
}

async function mountAdmin(format: LeagueFormat) {
  setupLeagueSession(makeUser('admin'), [makeLeague(7, championshipA, { format })])
  vi.mocked(leaguesService.table).mockResolvedValue(TABLES[format])
  const router = createTestRouter()
  await router.push('/admin/liga/7/tabela')
  const wrapper = mount(LeagueTableView, { global: { plugins: [createTestVuetify(), router] } })
  await flushPromises()
  return wrapper
}

describe('Tabela da liga (admin)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('pontos corridos: classificação na ordem do backend (GET /leagues/{id}/table)', async () => {
    const wrapper = await mountAdmin('round_robin')

    expect(leaguesService.table).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('Pontos corridos')
    const rows = wrapper.findAll('[data-test="standings-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('1')
    expect(rows[0].text()).toContain('Vitória')
    expect(rows[1].text()).toContain('Bahia')
    expect(wrapper.find('[data-test="knockout-phases"]').exists()).toBe(false)
  })

  it('mata-mata: chaveamento por fase com agregado, vencedor e confronto em aberto', async () => {
    const wrapper = await mountAdmin('knockout')

    expect(wrapper.find('[data-test="standings-table"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="knockout-phase"]').text()).toContain('Semifinal')
    const ties = wrapper.findAll('[data-test="knockout-tie"]').map((t) => t.text())
    expect(ties[0]).toContain('Ida · Vitória × Bahia2 × 0')
    expect(ties[0]).toContain('Volta · Bahia × Vitória1 × 1')
    expect(ties[0]).toContain('Classificado: Vitória')
    expect(ties[1]).toContain('Jogo único · Sport × Náutico10/05/2026')
    expect(ties[1]).toContain('Em disputa')
  })

  it('híbrido: fase de grupos e mata-mata na mesma tela', async () => {
    const wrapper = await mountAdmin('hybrid')

    expect(wrapper.text()).toContain('Fase de grupos')
    expect(wrapper.text()).toContain('Mata-mata')
    expect(wrapper.findAll('[data-test="standings-row"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-test="knockout-tie"]')).toHaveLength(2)
  })

  it('mostra a mensagem do backend quando a tabela falha', async () => {
    setupLeagueSession(makeUser('admin'), [makeLeague(7, championshipA)])
    vi.mocked(leaguesService.table).mockRejectedValue(apiError(403, 'Você não tem acesso a este recurso.'))
    const router = createTestRouter()
    await router.push('/admin/liga/7/tabela')
    const wrapper = mount(LeagueTableView, { global: { plugins: [createTestVuetify(), router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Você não tem acesso a este recurso.')
  })

  it('a aba Tabela pública usa o mesmo componente, com a rota pública', async () => {
    vi.mocked(publicLeaguesService.get).mockResolvedValue(makeLeague(7, championshipA, { format: 'knockout' }))
    vi.mocked(publicLeaguesService.table).mockResolvedValue(TABLES.knockout)
    const router = createTestRouter()
    router.addRoute({ path: '/ligas/:id', name: 'leagues-detail', component: LeagueDetailView, props: true })
    for (const [path, name] of [
      ['/campeonatos', 'championships-list'],
      ['/campeonatos/:id', 'championships-detail'],
      ['/times/:id', 'teams-detail'],
      ['/partidas/:id', 'games-detail'],
    ]) {
      router.addRoute({ path, name, component: { render: () => null } })
    }
    await router.push('/ligas/7?tab=tabela')
    const wrapper = mount(LeagueDetailView, {
      props: { id: '7' },
      global: { plugins: [createTestVuetify(), router] },
    })
    await flushPromises()

    expect(wrapper.findComponent(LeagueTablePanel).props('format')).toBe('knockout')
    expect(publicLeaguesService.table).toHaveBeenCalledWith('7')
    expect(leaguesService.table).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-test="knockout-tie"]')).toHaveLength(2)
  })
})
