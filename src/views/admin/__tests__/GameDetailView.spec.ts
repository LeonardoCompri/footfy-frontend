import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createWebHistory, type Router } from 'vue-router'
import GameDetailView from '@/views/admin/games/GameDetailView.vue'
import { gamesService } from '@/services/api/games.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { eventTypesService } from '@/services/api/eventTypes.service'
import { leaguesService } from '@/services/api/leagues.service'
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
import { apiError, defaultEventTypes, makeEvent, makeGame, makeTeam } from '@/test/factories'
import type { Game } from '@/types/game'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: { get: vi.fn(), update: vi.fn(), remove: vi.fn(), updatePenalties: vi.fn() },
}))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))
vi.mock('@/services/api/gameEvents.service', () => ({ gameEventsService: { list: vi.fn() } }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { table: vi.fn(), draw: vi.fn() },
}))
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

async function mountDetail(permissions: string[], query = '', router: Router = createTestRouter()) {
  setupLeagueSession(makeUser('admin', permissions), [makeLeague(7, championshipA, { format: 'knockout' })])
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
    vi.mocked(eventTypesService.list).mockResolvedValue(defaultEventTypes())
    vi.mocked(gamesService.get).mockResolvedValue(game)
    vi.mocked(gameEventsService.list).mockResolvedValue([])
    vi.mocked(teamsService.get).mockImplementation(async (id) => (Number(id) === 1 ? vitoria : bahia))
    vi.mocked(teamsService.list).mockResolvedValue([vitoria, bahia])
    vi.mocked(stadiumsService.list).mockResolvedValue([])
    vi.mocked(leaguesService.table).mockResolvedValue({})
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

  it('aba Súmula pela querystring usa os eventos do GET /games/{id}, sem outras requisições', async () => {
    vi.mocked(gamesService.get).mockResolvedValue({
      ...game,
      events: [
        makeEvent(1, {
          game_id: 4,
          team_id: 1,
          player_id: 11,
          player: { id: 11, name: 'Renato', removed: false },
          minute: 30,
        }),
      ],
    })
    const { wrapper } = await mountDetail(['game:read'], '?tab=sumula')

    expect(gamesService.get).toHaveBeenCalledTimes(1)
    expect(gameEventsService.list).not.toHaveBeenCalled()
    expect(teamsService.get).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="event-row"]').text()).toContain('Renato')
    expect(wrapper.find('[data-test="event-subtitle"]').text()).toBe('Gol · Vitória')
  })

  it('mudança na súmula recarrega a partida (placar recalculado pelo backend)', async () => {
    const { wrapper } = await mountDetail(['game:read'], '?tab=sumula')
    expect(wrapper.find('[data-test="events-empty"]').exists()).toBe(true)

    vi.mocked(gamesService.get).mockResolvedValue({
      ...game,
      home_score: 2,
      events: [makeEvent(1, { game_id: 4, team_id: 1, player_id: 11, minute: 30 })],
    })
    wrapper.findComponent({ name: 'GameEventsPanel' }).vm.$emit('changed')
    await flushPromises()

    expect(gamesService.get).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="game-score"]').text()).toBe('2 × 0')
    expect(wrapper.findAll('[data-test="event-row"]')).toHaveLength(1)
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

  it('editar sugere as fases já usadas na liga e reaproveita a ordem delas', async () => {
    vi.mocked(leaguesService.table).mockResolvedValue({
      phases: [
        { phase: 'Repescagem', phase_order: 1, ties: [] },
        { phase: 'Repescagem', phase_order: 1, ties: [] },
        { phase: 'Semifinal', phase_order: 2, ties: [] },
      ],
    })
    vi.mocked(gamesService.get).mockResolvedValue({ ...game, phase: null, phase_order: null })
    const { wrapper } = await mountDetail(['game:update'])
    expect(leaguesService.table).not.toHaveBeenCalled()

    await wrapper.find('[data-test="game-edit"]').trigger('click')
    await flushPromises()

    expect(leaguesService.table).toHaveBeenCalledWith(7)
    const phase = wrapper
      .findAllComponents({ name: 'VCombobox' })
      .find((c) => c.attributes('data-test') === 'game-phase')!
    expect(phase.props('items')).toEqual([
      'Repescagem',
      'Semifinal',
      'Oitavas de final',
      'Quartas de final',
      'Final',
    ])
    phase.vm.$emit('update:modelValue', 'Repescagem')
    await flushPromises()
    const order = wrapper
      .findAllComponents({ name: 'VTextField' })
      .find((c) => c.attributes('data-test') === 'game-phase-order')!
    expect(order.props('modelValue')).toBe(1)
  })

  it('salvar a edição não envia o placar e recarrega a partida', async () => {
    vi.mocked(gamesService.update).mockResolvedValue({ ...game, status: 'in_progress' })
    const { wrapper } = await mountDetail(['game:update'])
    await wrapper.find('[data-test="game-edit"]').trigger('click')
    await flushPromises()
    ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(gamesService.update).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        league_id: 7,
        home_team_id: 1,
        away_team_id: 2,
        phase: 'Semifinal',
      }),
    )
    const payload = vi.mocked(gamesService.update).mock.calls[0][1]
    expect(payload).not.toHaveProperty('home_score')
    expect(payload).not.toHaveProperty('away_score')
    expect(gamesService.get).toHaveBeenCalledTimes(2)
  })

  it('aberta direto, "Partidas" leva para a lista sem filtros', async () => {
    const { wrapper } = await mountDetail(['game:read'])

    expect(wrapper.find('[data-test="back-to-games"]').attributes('href')).toBe(
      '/admin/liga/7/partidas',
    )
  })

  it('vinda da lista, "Partidas" volta com os filtros e a página (mesmo após trocar de aba)', async () => {
    const router = createTestRouter(createWebHistory())
    await router.push('/admin/liga/7/partidas?status=finished&page=2')
    const { wrapper } = await mountDetail(['game:read'], '', router)
    await wrapper.find('[data-test="tab-sumula"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.tab).toBe('sumula'))

    expect(wrapper.find('[data-test="back-to-games"]').attributes('href')).toBe(
      '/admin/liga/7/partidas?status=finished&page=2',
    )
  })

  it('vinda de outra tela, "Partidas" leva para a lista sem filtros', async () => {
    const router = createTestRouter(createWebHistory())
    await router.push('/admin/liga/7')
    const { wrapper } = await mountDetail(['game:read'], '', router)

    expect(wrapper.find('[data-test="back-to-games"]').attributes('href')).toBe(
      '/admin/liga/7/partidas',
    )
  })

  it('excluir volta para a lista com os filtros de onde a partida foi aberta', async () => {
    vi.mocked(gamesService.remove).mockResolvedValue({} as never)
    const router = createTestRouter(createWebHistory())
    await router.push('/admin/liga/7/partidas?team_id=2')
    const { wrapper } = await mountDetail(['game:delete'], '', router)
    await wrapper.find('[data-test="game-delete"]').trigger('click')
    await flushPromises()
    const confirm = [...document.querySelectorAll('.v-overlay--active button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/admin/liga/7/partidas?team_id=2'),
    )
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

  describe('partida sorteada', () => {
    const drawnGame = makeGame(4, {
      league_id: 7,
      round: 5,
      group_number: 2,
      homeTeam: vitoria,
      awayTeam: bahia,
    })

    async function mountDrawn(permissions: string[]) {
      vi.mocked(gamesService.get).mockResolvedValue(drawnGame)
      vi.mocked(leaguesService.draw).mockResolvedValue({ rounds_per_turn: 3 } as never)
      setupLeagueSession(makeUser('admin', permissions), [
        makeLeague(7, championshipA, {
          format: 'hybrid',
          fixture_mode: 'draw',
          groups_count: 2,
          group_legs: 2,
        }),
      ])
      const router = createTestRouter()
      await router.push('/admin/liga/7/partidas/4')
      const wrapper = mount(GameDetailView, {
        props: { id: '4' },
        global: { plugins: [createTestVuetify(), router] },
        attachTo: document.body,
      })
      await flushPromises()
      return wrapper
    }

    it('mostra o grupo e deixa Excluir desabilitado, com dica para desfazer a rodada', async () => {
      const wrapper = await mountDrawn(['game:read', 'game:update', 'game:delete'])

      expect(wrapper.find('[data-test="game-details"]').text()).toContain('Grupo B')
      const del = wrapper.find('[data-test="game-delete"]')
      expect(del.attributes('disabled')).toBeDefined()
      await del.trigger('click')
      await flushPromises()
      expect(gamesService.remove).not.toHaveBeenCalled()
      const tooltip = wrapper.findComponent({ name: 'VTooltip' })
      expect(tooltip.props('text')).toBe(
        'Partidas sorteadas não podem ser excluídas. Use “Desfazer rodada” no Sorteio.',
      )
    })

    it('editar busca rounds_per_turn no sorteio e trava os times do returno', async () => {
      const wrapper = await mountDrawn(['game:read', 'game:update'])

      await wrapper.find('[data-test="game-edit"]').trigger('click')
      await flushPromises()

      expect(leaguesService.draw).toHaveBeenCalledWith(7)
      const dialog = wrapper.findComponent({ name: 'GameFormDialog' })
      expect(dialog.props()).toMatchObject({
        fixtureMode: 'draw',
        roundsPerTurn: 3,
        groupsCount: 2,
      })
      const home = wrapper
        .findAllComponents({ name: 'VAutocomplete' })
        .find((c) => c.attributes('data-test') === 'game-home-team')
      expect(home?.props('disabled')).toBe(true)
    })
  })

  describe('partida gerada pelo mata-mata', () => {
    const generated = (extra: Partial<Game> = {}) =>
      makeGame(4, {
        league_id: 7,
        round: null,
        phase: 'Quartas de final',
        phase_order: 2,
        tie_key: 'QF-1',
        leg: 2,
        knockout_stage: 'QF',
        home_score: 1,
        away_score: 1,
        status: 'finished',
        homeTeam: vitoria,
        awayTeam: bahia,
        penalties_allowed: false,
        home_penalties: null,
        away_penalties: null,
        ...extra,
      })

    async function mountGenerated(
      data: Game,
      permissions = ['game:read', 'game:update', 'game:delete'],
    ) {
      vi.mocked(gamesService.get).mockResolvedValue(data)
      setupLeagueSession(makeUser('admin', permissions), [
        makeLeague(7, championshipA, { format: 'hybrid', fixture_mode: 'draw', groups_count: 2 }),
      ])
      const router = createTestRouter()
      await router.push('/admin/liga/7/partidas/4?tab=sumula')
      const wrapper = mount(GameDetailView, {
        props: { id: '4' },
        global: { plugins: [createTestVuetify(), router] },
        attachTo: document.body,
      })
      await flushPromises()
      return wrapper
    }

    function penaltiesField(wrapper: ReturnType<typeof mount>, side: 'home' | 'away') {
      return wrapper
        .findAllComponents({ name: 'VTextField' })
        .find((c) => c.attributes('data-test') === `game-penalties-${side}`)!
    }

    async function fill(wrapper: ReturnType<typeof mount>, home: string, away: string) {
      penaltiesField(wrapper, 'home').vm.$emit('update:modelValue', home)
      penaltiesField(wrapper, 'away').vm.$emit('update:modelValue', away)
      await flushPromises()
    }

    async function save(wrapper: ReturnType<typeof mount>) {
      await wrapper.find('[data-test="game-penalties"] form').trigger('submit')
      await flushPromises()
    }

    it('Excluir desabilitado com dica para desfazer a fase no mata-mata', async () => {
      const wrapper = await mountGenerated(generated())

      const del = wrapper.find('[data-test="game-delete-knockout"] [data-test="game-delete"]')
      expect(del.attributes('disabled')).toBeDefined()
      await del.trigger('click')
      expect(gamesService.remove).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'VTooltip' }).props('text')).toBe(
        'Partidas geradas pelo mata-mata não podem ser excluídas. Desfaça a fase no Mata-mata do Sorteio.',
      )
    })

    it('placar com pênaltis entre parênteses', async () => {
      const wrapper = await mountGenerated(generated({ home_penalties: 3, away_penalties: 4 }))

      expect(wrapper.find('[data-test="game-score"]').text()).toBe('1 (3) × (4) 1')
      const mobileLine = wrapper.find('[data-test="game-score-penalties"]')
      expect(mobileLine.findAll('div').map((line) => line.text())).toEqual(['Pênaltis', '3 × 4'])
      expect(mobileLine.classes()).toContain('d-sm-none')
    })

    it.each([
      ['permitido e sem pênaltis', { penalties_allowed: true }, true],
      ['não permitido e sem pênaltis', { penalties_allowed: false }, false],
      [
        'não permitido mas com pênaltis gravados',
        { penalties_allowed: false, home_penalties: 5, away_penalties: 4 },
        true,
      ],
      ['jogo de fase manual', { knockout_stage: null, penalties_allowed: false }, false],
    ] as const)('campos de pênaltis: %s', async (_label, extra, visible) => {
      const wrapper = await mountGenerated(generated(extra))

      expect(wrapper.find('[data-test="game-penalties"]').exists()).toBe(visible)
    })

    it('sem game:update não mostra os campos de pênaltis', async () => {
      const wrapper = await mountGenerated(generated({ penalties_allowed: true }), ['game:read'])

      expect(wrapper.find('[data-test="game-penalties"]').exists()).toBe(false)
    })

    it.each([
      ['', '3', 'Informe os pênaltis dos dois times.'],
      ['3', '3', 'A disputa de pênaltis não pode terminar empatada.'],
      ['100', '3', 'Informe um número inteiro de 0 a 99.'],
      ['2.5', '3', 'Informe um número inteiro de 0 a 99.'],
      ['-1', '3', 'Informe um número inteiro de 0 a 99.'],
    ])('valida antes de enviar: "%s" × "%s"', async (home, away, message) => {
      const wrapper = await mountGenerated(generated({ penalties_allowed: true }))

      await fill(wrapper, home, away)
      await save(wrapper)

      expect(gamesService.updatePenalties).not.toHaveBeenCalled()
      expect(penaltiesField(wrapper, 'home').props('errorMessages')).toEqual([message])
    })

    it('salvar envia só os pênaltis e atualiza o placar com a resposta', async () => {
      vi.mocked(gamesService.updatePenalties).mockResolvedValue(
        generated({ penalties_allowed: true, home_penalties: 4, away_penalties: 3 }),
      )
      const wrapper = await mountGenerated(generated({ penalties_allowed: true }))

      await fill(wrapper, '4', '3')
      await save(wrapper)

      expect(gamesService.updatePenalties).toHaveBeenCalledWith(4, {
        home_penalties: 4,
        away_penalties: 3,
      })
      expect(wrapper.find('[data-test="game-score"]').text()).toBe('1 (4) × (3) 1')
      expect(wrapper.find('[data-test="game-penalties-clear"]').exists()).toBe(true)
    })

    it('422 do back aparece no campo do mandante', async () => {
      vi.mocked(gamesService.updatePenalties).mockRejectedValue(
        apiError(422, 'Erro', {
          home_penalties: ['Os pênaltis são lançados no jogo de volta do confronto.'],
        }),
      )
      const wrapper = await mountGenerated(generated({ penalties_allowed: true }))

      await fill(wrapper, '4', '3')
      await save(wrapper)

      expect(penaltiesField(wrapper, 'home').props('errorMessages')).toEqual([
        'Os pênaltis são lançados no jogo de volta do confronto.',
      ])
    })

    it('limpar envia os dois pênaltis nulos', async () => {
      vi.mocked(gamesService.updatePenalties).mockResolvedValue(generated())
      const wrapper = await mountGenerated(generated({ home_penalties: 5, away_penalties: 4 }))

      await wrapper.find('[data-test="game-penalties-clear"]').trigger('click')
      await flushPromises()

      expect(gamesService.updatePenalties).toHaveBeenCalledWith(4, {
        home_penalties: null,
        away_penalties: null,
      })
      expect(wrapper.find('[data-test="game-penalties"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="game-score"]').text()).toBe('1 × 1')
    })
  })
})
