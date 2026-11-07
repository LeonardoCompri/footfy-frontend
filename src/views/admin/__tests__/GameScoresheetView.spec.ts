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
import { apiError, defaultEventTypes, makeEventType, makeGame, makeTeam } from '@/test/factories'

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
    expect(wrapper.find('[data-test="scoresheet-competition"]').text()).toBe('Brasileiro›Série A')
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
