import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LeagueDetailView from '@/views/public/leagues/LeagueDetailView.vue'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import { championshipA, createTestRouter, createTestVuetify, makeLeague } from '@/test/utils'
import { makeGame, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/publicLeagues.service', () => ({
  publicLeaguesService: { get: vi.fn(), table: vi.fn(), statistics: vi.fn() },
}))

const league = makeLeague(1, championshipA, {
  format: 'hybrid',
  teams: [makeTeam(1, 'Serrano'), makeTeam(2, 'Ribeirinho')],
  games: [
    makeGame(10, {
      round: null,
      phase: 'Final',
      phase_order: 2,
      home_score: 2,
      away_score: 2,
      home_penalties: 4,
      away_penalties: 3,
      status: 'finished',
    }),
    makeGame(11, { round: 2, home_score: 1, away_score: 0, status: 'finished' }),
    makeGame(12, { round: null, phase: 'Semifinal', phase_order: 1, leg: 1 }),
    makeGame(13, { round: 1, home_score: 0, away_score: 3, status: 'finished' }),
  ],
})

async function mountView() {
  const router = createTestRouter()
  await router.push('/ligas/1?tab=partidas')
  const wrapper = mount(LeagueDetailView, {
    props: { id: '1' },
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return wrapper
}

function rows(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper
    .find('[data-test=public-games-table]')
    .findAll('tbody tr')
    .map((row) => row.findAll('td').map((cell) => cell.text()))
}

describe('LeagueDetailView público — aba Partidas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicLeaguesService.get).mockResolvedValue(league)
  })

  it('lista as rodadas antes do mata-mata, com o nome da fase na coluna Etapa', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-test=public-games-table] thead').text()).toContain('Etapa')
    expect(rows(wrapper).map(([stage]) => stage)).toEqual([
      '1ª rodada',
      '2ª rodada',
      'Semifinal · Ida',
      'Final',
    ])
  })

  it('mostra o placar com × e os pênaltis, e traço quando não há resultado', async () => {
    const wrapper = await mountView()

    expect(rows(wrapper).map((cells) => cells.slice(1, 4))).toEqual([
      ['Serrano', '0 × 3', 'Ribeirinho'],
      ['Serrano', '1 × 0', 'Ribeirinho'],
      ['Serrano', '— × —', 'Ribeirinho'],
      ['Serrano', '2 (4) × (3) 2', 'Ribeirinho'],
    ])
  })
})
