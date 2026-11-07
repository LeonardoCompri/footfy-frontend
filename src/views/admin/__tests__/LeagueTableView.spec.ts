import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LeagueTableView from '@/views/admin/leagues/LeagueTableView.vue'
import LeagueDetailView from '@/views/public/leagues/LeagueDetailView.vue'
import LeagueTablePanel from '@/components/leagues/LeagueTablePanel.vue'
import { leaguesService } from '@/services/api/leagues.service'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import type { League, LeagueFormat } from '@/types/championship'
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

async function mountAdmin(
  format: LeagueFormat,
  table: LeagueTable = TABLES[format],
  leagueExtra: Partial<League> = {},
) {
  setupLeagueSession(makeUser('admin'), [makeLeague(7, championshipA, { format, ...leagueExtra })])
  vi.mocked(leaguesService.table).mockResolvedValue(table)
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

  it('2+ grupos: uma tabela por grupo, classificados destacados e uma legenda só', async () => {
    const groupA = [standing(1, 'Vitória', 6), { ...standing(2, 'Bahia', 3), tied: true }]
    const groupB = [standing(3, 'Sport', 6), standing(4, 'Náutico', 0)]
    groupA.push({ ...standing(5, 'Ceará', 3), tied: true })
    const wrapper = await mountAdmin(
      'hybrid',
      {
        standings: [...groupA, ...groupB],
        groups: [
          { group_number: 1, standings: groupA },
          { group_number: 2, standings: groupB },
        ],
        tiebreakers: ['points', 'head_to_head', 'goal_difference'],
        phases,
      },
      { fixture_mode: 'draw', groups_count: 2, qualifiers_per_group: 2 },
    )

    const groups = wrapper.findAll('[data-test="standings-group"]')
    expect(groups.map((g) => g.find('[data-test="standings-title"]').text())).toEqual([
      'Grupo A',
      'Grupo B',
    ])
    expect(groups[0].findAll('[data-test="standings-row"]').map((r) => r.text())).toEqual([
      expect.stringContaining('Vitória'),
      expect.stringContaining('Bahia'),
      expect.stringContaining('Ceará'),
    ])
    expect(groups[1].findAll('[data-test="standings-row"]')).toHaveLength(2)
    expect(groups[0].findAll('[data-test="standings-qualified"]')).toHaveLength(2)
    expect(groups[1].findAll('[data-test="standings-qualified"]')).toHaveLength(2)
    expect(groups[0].findAll('[data-test="standings-tied"]')).toHaveLength(2)

    const legends = wrapper.findAll('[data-test="standings-legend"]')
    expect(legends).toHaveLength(1)
    expect(legends[0].find('[data-test="standings-tiebreakers"]').text()).toBe(
      'Desempate: confronto direto e saldo de gols.',
    )
    expect(legends[0].find('[data-test="standings-legend-qualified"]').text()).toBe(
      'Classificam-se os 2 primeiros de cada grupo para o mata-mata.',
    )
    expect(legends[0].find('[data-test="standings-legend-tied"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="knockout-tie"]')).toHaveLength(2)
  })

  it('grupo vazio mostra aviso e time sem grupo aparece em "Sem grupo"', async () => {
    const vitoria = standing(1, 'Vitória', 3)
    const bahia = standing(2, 'Bahia', 0)
    const wrapper = await mountAdmin(
      'hybrid',
      {
        standings: [vitoria, bahia],
        groups: [
          { group_number: 1, standings: [vitoria] },
          { group_number: 2, standings: [] },
        ],
        tiebreakers: ['points'],
        phases: [],
      },
      { fixture_mode: 'manual', groups_count: 2 },
    )

    const groups = wrapper.findAll('[data-test="standings-group"]')
    expect(groups).toHaveLength(2)
    expect(groups[1].text()).toContain('Nenhum time neste grupo ainda.')
    expect(groups[1].find('[data-test="standings-table"]').exists()).toBe(false)
    const ungrouped = wrapper.find('[data-test="standings-ungrouped"]')
    expect(ungrouped.find('[data-test="standings-title"]').text()).toBe('Sem grupo')
    expect(ungrouped.findAll('[data-test="standings-row"]').map((r) => r.text())).toEqual([
      expect.stringContaining('Bahia'),
    ])
    expect(wrapper.findAll('[data-test="standings-legend"]')).toHaveLength(1)
  })

  it('mata-mata sem standings, groups e tiebreakers não quebra', async () => {
    const wrapper = await mountAdmin('knockout', { phases })

    expect(wrapper.find('[data-test="standings-legend"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="standings-group"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="knockout-tie"]')).toHaveLength(2)
  })

  it('1 grupo: tabela única sem título de grupo, como antes', async () => {
    const rows = [standing(1, 'Vitória', 9), standing(2, 'Bahia', 6)]
    const wrapper = await mountAdmin('round_robin', {
      standings: rows,
      groups: [{ group_number: 1, standings: rows }],
      tiebreakers: ['points', 'wins'],
    })

    expect(wrapper.find('[data-test="standings-groups"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="standings-title"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="standings-row"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="standings-tiebreakers"]').text()).toBe('Desempate: vitórias.')
    expect(wrapper.find('[data-test="standings-qualified"]').exists()).toBe(false)
  })

  it('liga híbrida manual não destaca classificados', async () => {
    const wrapper = await mountAdmin('hybrid', TABLES.hybrid, {
      fixture_mode: 'manual',
      qualifiers_per_group: 2,
    })

    expect(wrapper.find('[data-test="standings-qualified"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="standings-legend-qualified"]').exists()).toBe(false)
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
    vi.mocked(publicLeaguesService.get).mockResolvedValue(
      makeLeague(7, championshipA, {
        format: 'hybrid',
        fixture_mode: 'draw',
        qualifiers_per_group: 2,
      }),
    )
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

    expect(wrapper.findComponent(LeagueTablePanel).props('format')).toBe('hybrid')
    expect(wrapper.findComponent(LeagueTablePanel).props('qualifiers')).toBe(2)
    expect(publicLeaguesService.table).toHaveBeenCalledWith('7')
    expect(leaguesService.table).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-test="knockout-tie"]')).toHaveLength(2)
  })

  describe('chave do mata-mata gerado (pública)', () => {
    const tieTeams = (a: [number, string, number], b: [number, string, number]) =>
      [a, b].map(([team_id, nickname, aggregate_score]) => ({
        team_id,
        name: `${nickname} FC`,
        nickname,
        aggregate_score,
      }))
    const leg = (id: number, home: number, away: number, score: [number, number] | null, extra = {}) => ({
      id,
      leg: null,
      home_team_id: home,
      away_team_id: away,
      home_score: score ? score[0] : null,
      away_score: score ? score[1] : null,
      status: score ? ('finished' as const) : ('scheduled' as const),
      match_date: null,
      ...extra,
    })

    const semifinals: KnockoutPhase = {
      phase: 'Semifinal',
      phase_order: 3,
      stage: 'SF',
      ties: [
        {
          tie_key: 'SF-1',
          decided: true,
          winner_team_id: 2,
          decided_by: 'penalties',
          awaiting_penalties: false,
          decisive_game_id: 20,
          home_penalties: 3,
          away_penalties: 4,
          teams: tieTeams([1, 'Vitória', 1], [2, 'Bahia', 1]),
          legs: [leg(20, 1, 2, [1, 1], { home_penalties: 3, away_penalties: 4 })],
        },
        {
          tie_key: 'SF-2',
          decided: true,
          winner_team_id: null,
          decided_by: null,
          awaiting_penalties: true,
          decisive_game_id: 21,
          home_penalties: null,
          away_penalties: null,
          teams: tieTeams([3, 'Sport', 0], [4, 'Náutico', 0]),
          legs: [leg(21, 3, 4, [0, 0])],
        },
      ],
    }

    async function mountPublic(phases: KnockoutPhase[]) {
      vi.mocked(publicLeaguesService.get).mockResolvedValue(
        makeLeague(7, championshipA, {
          format: 'hybrid',
          fixture_mode: 'draw',
          groups_count: 2,
          qualifiers_per_group: 2,
          knockout_size: 4,
          third_place: true,
        }),
      )
      vi.mocked(publicLeaguesService.table).mockResolvedValue({ standings: [], phases })
      const router = createTestRouter()
      router.addRoute({
        path: '/ligas/:id',
        name: 'leagues-detail',
        component: LeagueDetailView,
        props: true,
      })
      await router.push('/ligas/7?tab=tabela')
      const wrapper = mount(LeagueDetailView, {
        props: { id: '7' },
        global: { plugins: [createTestVuetify(), router] },
      })
      await flushPromises()
      return wrapper
    }

    const titles = (wrapper: ReturnType<typeof mount>) =>
      wrapper.findAll('[data-test="knockout-phase-title"]').map((t) => t.text())

    it('semifinal: pênaltis, aguardando pênaltis e as fases seguintes projetadas', async () => {
      const wrapper = await mountPublic([semifinals])

      expect(titles(wrapper)).toEqual(['Semifinal', 'Disputa de 3º lugar', 'Final'])
      const outcomes = wrapper.findAll('[data-test="knockout-tie-outcome"]').map((o) => o.text())
      expect(outcomes).toEqual(['Classificado: Bahia nos pênaltis (4 × 3)', 'Aguardando pênaltis'])
      expect(wrapper.find('[data-test="knockout-leg-score"]').text()).toBe('1 (3) × (4) 1')
      expect(wrapper.find('[data-test="knockout-leg"]').attributes('href')).toBeUndefined()
      const future = wrapper.findAll('[data-test="knockout-future-tie"]').map((t) => t.text())
      expect(future).toEqual([
        expect.stringContaining('3P-1Vitória×Perdedor SF-2'),
        expect.stringContaining('F-1Bahia×Vencedor SF-2'),
      ])
    })

    it('final e 3º lugar gerados seguem o phase_order, com campeão e 3º colocado', async () => {
      const decided = (key: string, winner: number, teams: ReturnType<typeof tieTeams>, id: number) => ({
        tie_key: key,
        decided: true,
        winner_team_id: winner,
        decided_by: 'aggregate' as const,
        awaiting_penalties: false,
        decisive_game_id: id,
        home_penalties: null,
        away_penalties: null,
        teams,
        legs: [leg(id, teams[0].team_id, teams[1].team_id, [2, 0])],
      })
      const wrapper = await mountPublic([
        {
          phase: 'Final',
          phase_order: 5,
          stage: 'F',
          ties: [decided('F-1', 2, tieTeams([2, 'Bahia', 2], [3, 'Sport', 0]), 30)],
        },
        {
          phase: 'Disputa de 3º lugar',
          phase_order: 4,
          stage: '3P',
          ties: [decided('3P-1', 1, tieTeams([1, 'Vitória', 2], [4, 'Náutico', 0]), 31)],
        },
        semifinals,
      ])

      expect(titles(wrapper)).toEqual(['Semifinal', 'Disputa de 3º lugar', 'Final'])
      expect(wrapper.find('[data-test="knockout-future-tie"]').exists()).toBe(false)
      const outcomes = wrapper.findAll('[data-test="knockout-tie-outcome"]').map((o) => o.text())
      expect(outcomes.slice(2)).toEqual(['3º lugar: Vitória', 'Campeão: Bahia'])
    })
  })
})
