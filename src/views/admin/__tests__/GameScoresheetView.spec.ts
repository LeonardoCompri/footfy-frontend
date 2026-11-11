import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameScoresheetView from '@/views/admin/games/GameScoresheetView.vue'
import { gamesService } from '@/services/api/games.service'
import { eventTypesService } from '@/services/api/eventTypes.service'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import {
  apiError,
  defaultEventTypes,
  makeEvent,
  makeEventType,
  makeGame,
  makePlayer,
  makeTeam,
} from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({ gamesService: { get: vi.fn() } }))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))

const game = makeGame(4, {
  league_id: 7,
  homeTeam: makeTeam(1, 'Esporte Clube Vitória', { players: [] }),
  awayTeam: makeTeam(2, 'Esporte Clube Bahia', { players: [] }),
})

async function mountView() {
  setupLeagueSession(makeUser('admin', ['game:read', 'game_event:create']), [
    makeLeague(7, championshipA, { name: 'Série A' }),
  ])
  const router = createTestRouter()
  await router.push('/admin/liga/7/partidas/4/sumula')
  const wrapper = mount(GameScoresheetView, {
    props: { id: '4' },
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  return { wrapper, router }
}

const pageStyles = () =>
  Array.from(document.head.querySelectorAll('style')).filter((style) =>
    style.textContent?.includes('@page { size: A4 landscape; margin: 0; }'),
  )

describe('GameScoresheetView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    document.title = 'Futy'
    pageStyles().forEach((style) => style.remove())
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(gamesService.get).mockResolvedValue(game)
    vi.mocked(eventTypesService.list).mockResolvedValue([
      ...defaultEventTypes(),
      makeEventType(9, 'legacy', { name: 'Tipo antigo', active: false }),
    ])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('só mostra as folhas depois de carregar a partida e os tipos de evento', async () => {
    let resolveGame: (value: typeof game) => void = () => {}
    vi.mocked(gamesService.get).mockReturnValue(new Promise((resolve) => (resolveGame = resolve)))
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="scoresheet"]').exists()).toBe(false)
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)

    resolveGame(game)
    await flushPromises()

    expect(gamesService.get).toHaveBeenCalledWith('4')
    expect(wrapper.findAll('[data-test="scoresheet-sheet"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="scoresheet-competition"]').text()).toBe('Brasileiro · Série A')
    expect(wrapper.findAll('[data-test="scoresheet-legend-type"]')).toHaveLength(4)
    expect(document.title).toBe('Súmula #0004 - Esporte Clube Vitória x Esporte Clube Bahia')
  })

  it('aplica o @page A4 paisagem só enquanto a tela está aberta', async () => {
    const { wrapper } = await mountView()
    await flushPromises()
    expect(pageStyles()).toHaveLength(1)

    wrapper.unmount()
    expect(pageStyles()).toHaveLength(0)
    expect(document.title).toBe('Futy')
  })

  it('imprimir espera as fontes e chama window.print', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    let fontsReady: () => void = () => {}
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>((resolve) => (fontsReady = resolve)) },
    })
    const { wrapper } = await mountView()
    await flushPromises()

    await wrapper.find('[data-test="scoresheet-print"]').trigger('click')
    await flushPromises()
    expect(print).not.toHaveBeenCalled()

    fontsReady()
    await flushPromises()
    expect(print).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(document, 'fonts')
  })

  it.each(['scheduled', 'in_progress', 'cancelled'] as const)(
    'partida %s imprime em branco, sem o controle',
    async (status) => {
      vi.mocked(gamesService.get).mockResolvedValue({
        ...game,
        status,
        home_score: 3,
        events: [makeEvent(1, { minute: 10 })],
      })
      const { wrapper } = await mountView()
      await flushPromises()

      expect(wrapper.find('[data-test="scoresheet-mode"]').exists()).toBe(false)
      expect(wrapper.find('.cb.on').exists()).toBe(false)
      expect(wrapper.find('[data-test="scoresheet-score-home"]').text()).toBe('')
    },
  )

  it('partida finalizada sai preenchida e pode trocar para em branco e voltar', async () => {
    vi.mocked(gamesService.get).mockResolvedValue({
      ...game,
      status: 'finished',
      home_score: 3,
      away_score: 1,
      events: [makeEvent(1, { minute: 10, team_id: 1 })],
    })
    const { wrapper } = await mountView()
    await flushPromises()

    const mode = wrapper.find('[data-test="scoresheet-mode"]')
    expect(mode.exists()).toBe(true)
    expect(mode.element.closest('.d-print-none')).not.toBeNull()
    expect(wrapper.find('[data-test="scoresheet-mode-filled"]').classes()).toContain(
      'v-btn--active',
    )
    expect(wrapper.find('[data-test="scoresheet-score-home"]').text()).toBe('3')
    expect(wrapper.find('.cb.on').exists()).toBe(true)

    await wrapper.find('[data-test="scoresheet-mode-blank"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="scoresheet-score-home"]').text()).toBe('')
    expect(wrapper.find('.cb.on').exists()).toBe(false)

    await wrapper.find('[data-test="scoresheet-mode-filled"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="scoresheet-score-home"]').text()).toBe('3')
  })

  it('evento de tipo desativado ganha caixa na preenchida', async () => {
    vi.mocked(gamesService.get).mockResolvedValue({
      ...game,
      status: 'finished',
      events: [makeEvent(1, { minute: 10, type: 'legacy' })],
    })
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.findAll('[data-test="scoresheet-legend-type"]')).toHaveLength(5)
    const marked = wrapper
      .find('[data-test="scoresheet-event-row"]')
      .findAll('.opt')
      .filter((option) => option.find('.cb.on').exists())
      .map((option) => option.text())
    expect(marked).toEqual(['TA', 'M'])

    await wrapper.find('[data-test="scoresheet-mode-blank"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-test="scoresheet-legend-type"]')).toHaveLength(4)
  })

  it('elenco acima do limite avisa fora da impressão e mantém a continuação', async () => {
    vi.mocked(gamesService.get).mockResolvedValue({
      ...game,
      league: { id: 7, name: 'Série A', championship: null, max_players_per_team: 11 },
      homeTeam: makeTeam(1, 'Esporte Clube Vitória', {
        players: Array.from({ length: 13 }, (_, index) => makePlayer(index + 1, `Atleta ${index}`)),
      }),
    })
    const { wrapper } = await mountView()
    await flushPromises()

    const alert = wrapper.find('[data-test="scoresheet-roster-limit"]')
    expect(alert.classes()).toContain('d-print-none')
    expect(alert.text()).toContain('A liga permite 11 jogadores por time')
    expect(alert.text()).toContain('Esporte Clube Vitória tem 13 atletas')
    expect(wrapper.findAll('[data-test="scoresheet-sheet"]')).toHaveLength(3)
  })

  it('elenco dentro do limite não mostra aviso', async () => {
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="scoresheet-roster-limit"]').exists()).toBe(false)
  })

  it('voltar leva para o detalhe da partida', async () => {
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="scoresheet-back"]').attributes('href')).toBe(
      '/admin/liga/7/partidas/4',
    )
  })

  it.each([
    [
      'partida',
      () => vi.mocked(gamesService.get).mockRejectedValue(apiError(404, 'Partida não encontrada!')),
    ],
    [
      'tipos de evento',
      () => vi.mocked(eventTypesService.list).mockRejectedValue(apiError(500, 'Falhou.')),
    ],
  ])('erro ao carregar %s mostra o aviso sem as folhas', async (_label, fail) => {
    fail()
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="scoresheet"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="scoresheet-error"]').exists()).toBe(true)
  })
})
