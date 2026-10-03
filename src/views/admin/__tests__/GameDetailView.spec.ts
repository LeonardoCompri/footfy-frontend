import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameDetailView from '@/views/admin/games/GameDetailView.vue'
import { gamesService } from '@/services/api/games.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import { teamsService } from '@/services/api/teams.service'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { makeGame, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: { get: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/services/api/gameEvents.service', () => ({ gameEventsService: { list: vi.fn() } }))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { get: vi.fn(), list: vi.fn() } }))
vi.mock('@/services/api/stadiums.service', () => ({ stadiumsService: { list: vi.fn() } }))

const vitoria = makeTeam(1, 'Esporte Clube Vitória', { nickname: 'Vitória', players: [] })
const bahia = makeTeam(2, 'Esporte Clube Bahia', { nickname: 'Bahia', players: [] })

const game = makeGame(4, {
  league_id: 7,
  round: null,
  phase: 'Semifinal',
  phase_order: 2,
  tie_key: 'SF1',
  leg: 2,
  home_score: 1,
  away_score: 0,
  status: 'finished',
  match_date: '2026-05-10 16:00:00',
  homeTeam: vitoria,
  awayTeam: bahia,
  stadium: { id: 3, league_id: 7, name: 'Barradão', city: 'Salvador', capacity: 35000, created_at: '', updated_at: '' },
})

async function mountDetail(permissions: string[], query = '') {
  setupLeagueSession(makeUser('admin', permissions), [makeLeague(7, championshipA, { format: 'knockout' })])
  const router = createTestRouter()
  await router.push(`/admin/liga/7/partidas/4${query}`)
  const wrapper = mount(GameDetailView, {
    props: { id: '4' },
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('GameDetailView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(gamesService.get).mockResolvedValue(game)
    vi.mocked(gameEventsService.list).mockResolvedValue([])
    vi.mocked(teamsService.get).mockImplementation(async (id) => (Number(id) === 1 ? vitoria : bahia))
    vi.mocked(teamsService.list).mockResolvedValue([vitoria, bahia])
    vi.mocked(stadiumsService.list).mockResolvedValue([])
  })

  it('mostra placar e as abas Detalhes do confronto | Súmula', async () => {
    const { wrapper } = await mountDetail(['game:read'])

    expect(gamesService.get).toHaveBeenCalledWith('4')
    const header = wrapper.find('[data-test="game-header"]').text()
    expect(header).toContain('Semifinal · Volta')
    expect(header).toContain('Finalizada')
    expect(wrapper.find('[data-test="game-score"]').text()).toBe('1 × 0')
    expect(wrapper.find('[data-test="tab-detalhes"]').text()).toBe('Detalhes do confronto')
    expect(wrapper.find('[data-test="tab-sumula"]').text()).toBe('Súmula')

    const details = wrapper.find('[data-test="game-details"]').text()
    expect(details).toContain('SF1')
    expect(details).toContain('Barradão · Salvador')
    expect(details).toContain('10/05/2026 16:00')
  })

  it('aba Súmula pela querystring carrega os eventos da partida', async () => {
    const { wrapper } = await mountDetail(['game:read'], '?tab=sumula')

    expect(gameEventsService.list).toHaveBeenCalledWith({ game_id: 4 })
    expect(wrapper.find('[data-test="events-empty"]').exists()).toBe(true)
  })

  it.each([
    ['só leitura', ['game:read'], [false, false]],
    ['game:update', ['game:read', 'game:update'], [true, false]],
    ['game:all', ['game:all'], [true, true]],
  ])('botões por permissão: %s', async (_label, permissions, [edit, del]) => {
    const { wrapper } = await mountDetail(permissions)
    expect(wrapper.find('[data-test="game-edit"]').exists()).toBe(edit)
    expect(wrapper.find('[data-test="game-delete"]').exists()).toBe(del)
  })

  it('editar abre o form já em modo Fase (liga mata-mata) com os dados da partida', async () => {
    const { wrapper } = await mountDetail(['game:update'])
    await wrapper.find('[data-test="game-edit"]').trigger('click')
    await flushPromises()

    expect(teamsService.list).toHaveBeenCalledWith({ league_id: 7 })
    expect(stadiumsService.list).toHaveBeenCalledWith({ league_id: 7 })
    const phase = wrapper.findAllComponents({ name: 'VCombobox' }).find((c) => c.attributes('data-test') === 'game-phase')
    expect(phase?.props('modelValue')).toBe('Semifinal')
    expect(document.querySelector('[data-test="game-round"]')).toBeNull()
  })

  it('excluir volta para a lista de partidas', async () => {
    vi.mocked(gamesService.remove).mockResolvedValue({} as never)
    const { wrapper, router } = await mountDetail(['game:delete'])
    await wrapper.find('[data-test="game-delete"]').trigger('click')
    await flushPromises()
    const confirm = [...document.querySelectorAll('.v-overlay--active button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(gamesService.remove).toHaveBeenCalledWith(4)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-games-list'))
  })
})
