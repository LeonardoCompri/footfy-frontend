import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createWebHistory, type Router } from 'vue-router'
import GameDetailView from '@/views/public/games/GameDetailView.vue'
import { publicGamesService } from '@/services/api/publicGames.service'
import { createTestRouter, createTestVuetify } from '@/test/utils'
import { apiError, makeGame, makeTeam } from '@/test/factories'
import type { Game } from '@/types/game'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/publicGames.service', () => ({ publicGamesService: { get: vi.fn() } }))

const kick = (order: number, team_id: number, number: number, scored: boolean) => ({
  id: order,
  order,
  team_id,
  player_id: order,
  scored,
  player: { id: order, name: `Cobrador ${order}`, number, removed: false },
})

const knockout = (extra: Partial<Game> = {}) =>
  makeGame(1, {
    round: null,
    phase: 'Final',
    knockout_stage: 'F',
    home_score: 1,
    away_score: 1,
    status: 'finished',
    homeTeam: makeTeam(1, 'Atlético Serrano', { nickname: 'Serrano' }),
    awayTeam: makeTeam(2, 'Clube Ribeirinho', { nickname: 'Ribeirinho' }),
    ...extra,
  })

async function mountDetail(path: string, router: Router = createTestRouter()) {
  await router.push(path)
  const wrapper = mount(GameDetailView, {
    props: { id: '1' },
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

function backButton(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  return wrapper.findAll('button').find((button) => button.text() === 'Voltar')!
}

describe('GameDetailView público', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicGamesService.get).mockResolvedValue(knockout())
  })

  it('Voltar sem histórico leva para a lista de campeonatos', async () => {
    const { wrapper, router } = await mountDetail('/partidas/1')

    await backButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('championships-list')
  })

  it('Voltar com histórico volta para a página anterior', async () => {
    const router = createTestRouter(createWebHistory())
    await router.push('/ligas/3')
    const { wrapper } = await mountDetail('/partidas/1', router)

    await backButton(wrapper).trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/ligas/3'))
  })

  it('mostra os times e o placar do jogo sem disputa de pênaltis', async () => {
    const { wrapper } = await mountDetail('/partidas/1')

    expect(publicGamesService.get).toHaveBeenCalledWith('1')
    expect(wrapper.find('[data-test="public-game-home"]').text()).toBe('Serrano')
    expect(wrapper.find('[data-test="public-game-away"]').text()).toBe('Ribeirinho')
    expect(wrapper.find('[data-test="public-game-score"]').text()).toBe('1 × 1')
    expect(wrapper.find('[data-test="game-shootout"]').exists()).toBe(false)
  })

  it('mostra a grade das cobranças, que não entram no placar do jogo', async () => {
    vi.mocked(publicGamesService.get).mockResolvedValue(
      knockout({
        home_penalties: 3,
        away_penalties: 0,
        penaltyKicks: [
          kick(1, 1, 10, true),
          kick(2, 2, 9, false),
          kick(3, 1, 8, true),
          kick(4, 2, 7, false),
          kick(5, 1, 4, true),
          kick(6, 2, 5, false),
        ],
      }),
    )
    const { wrapper } = await mountDetail('/partidas/1')

    expect(wrapper.find('[data-test="public-game-score"]').text()).toBe('1 × 1')
    expect(wrapper.find('[data-test="public-game-penalties"]').text()).toBe('Pênaltis 3 × 0')
    const grid = wrapper.find('[data-test="game-shootout"]')
    expect(grid.find('[data-test="shootout-row-home"] [data-test="shootout-total"]').text()).toBe(
      '3',
    )
    expect(grid.find('[data-test="shootout-result"]').text()).toBe(
      'Disputa decidida: 3 × 0, Serrano vence',
    )
  })

  it('jogo antigo só com o placar dos pênaltis mostra o placar, sem grade', async () => {
    vi.mocked(publicGamesService.get).mockResolvedValue(
      knockout({ home_penalties: 4, away_penalties: 5, penaltyKicks: [] }),
    )
    const { wrapper } = await mountDetail('/partidas/1')

    const card = wrapper.find('[data-test="game-shootout"]')
    expect(card.find('[data-test="shootout-result"]').text()).toBe(
      'Pênaltis: 4 × 5, Ribeirinho vence',
    )
    expect(card.find('[data-test="shootout-kick"]').exists()).toBe(false)
  })

  it('erro da API aparece no lugar da partida', async () => {
    vi.mocked(publicGamesService.get).mockRejectedValue(apiError(422, 'Partida não encontrada!'))
    const { wrapper } = await mountDetail('/partidas/1')

    expect(wrapper.text()).toContain('Partida não encontrada!')
    expect(wrapper.find('[data-test="public-game-header"]').exists()).toBe(false)
  })
})
