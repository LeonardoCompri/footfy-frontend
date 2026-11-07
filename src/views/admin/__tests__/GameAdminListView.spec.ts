import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameAdminListView from '@/views/admin/games/GameAdminListView.vue'
import { gamesService } from '@/services/api/games.service'
import { leaguesService } from '@/services/api/leagues.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import { teamsService } from '@/services/api/teams.service'
import type { LeagueFormat } from '@/types/championship'
import type { FixtureMode } from '@/types/leagueRules'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError, makeGame, makePage, makeTeam } from '@/test/factories'
import type { GameListParams } from '@/types/game'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: {
    list: vi.fn(),
    listPaginated: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), table: vi.fn() },
}))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { list: vi.fn() } }))
vi.mock('@/services/api/stadiums.service', () => ({ stadiumsService: { list: vi.fn() } }))

const ALL = ['game:read', 'game:create', 'game:update', 'game:delete']

const games = [
  makeGame(2, { league_id: 7, round: 2, home_team_id: 2, away_team_id: 1, match_date: '2026-04-12 16:00:00' }),
  makeGame(1, {
    league_id: 7,
    round: 1,
    home_team_id: 1,
    away_team_id: 2,
    home_score: 2,
    away_score: 1,
    status: 'finished',
    match_date: '2026-04-05 16:00:00',
  }),
  makeGame(3, {
    league_id: 7,
    round: null,
    phase: 'Final',
    phase_order: 3,
    tie_key: 'F',
    leg: 1,
    home_team_id: 3,
    away_team_id: 2,
    homeTeam: makeTeam(3, 'Sport Club do Recife'),
    awayTeam: makeTeam(2, 'Esporte Clube Bahia', { nickname: 'Bahia' }),
  }),
]

const BASE = { league_id: 7, page: 1, per_page: 20 }

const phases = (...names: [string, number][]) => ({
  phases: names.map(([phase, phase_order]) => ({ phase, phase_order, ties: [] })),
})

async function mountList(
  permissions: string[] = ALL,
  format: LeagueFormat = 'round_robin',
  query = '',
  fixtureMode: FixtureMode = 'manual',
) {
  setupLeagueSession(makeUser('admin', permissions), [
    makeLeague(7, championshipA, { format, fixture_mode: fixtureMode }),
  ])
  const router = createTestRouter()
  await router.push(`/admin/liga/7/partidas${query}`)
  const wrapper = mount(GameAdminListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

function field(wrapper: VueWrapper, name: string, test: string) {
  const found = wrapper.findAllComponents({ name }).find((c) => c.attributes('data-test') === test)
  if (!found) throw new Error(`${name}[data-test=${test}] não encontrado`)
  return found
}

async function choose(wrapper: VueWrapper, name: string, test: string, value: unknown) {
  field(wrapper, name, test).vm.$emit('update:modelValue', value)
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

async function openCreate(wrapper: VueWrapper) {
  await wrapper.find('[data-test="game-create"]').trigger('click')
  await flushPromises()
}

async function search(wrapper: VueWrapper) {
  await wrapper.find('[data-test="game-search"]').trigger('click')
  await flushPromises()
}

async function nextPage(wrapper: VueWrapper) {
  await wrapper
    .find('[data-test="games-table"] button[aria-label="Próxima página"]')
    .trigger('click')
  await flushPromises()
}

function lastQuery(): GameListParams {
  return vi.mocked(gamesService.listPaginated).mock.lastCall![0]
}

function tableRows(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="games-table"] tbody tr').map((tr) => tr.text())
}

describe('GameAdminListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.innerWidth = 1366
    vi.mocked(gamesService.listPaginated).mockResolvedValue(
      makePage(games, { total: 45, last_page: 3 }),
    )
    vi.mocked(leaguesService.table).mockResolvedValue({})
    vi.mocked(teamsService.list).mockResolvedValue([
      makeTeam(1, 'Esporte Clube Vitória', { nickname: 'Vitória' }),
      makeTeam(2, 'Esporte Clube Bahia', { nickname: 'Bahia' }),
    ])
    vi.mocked(stadiumsService.list).mockResolvedValue([])
  })

  it('no mount busca a 1ª página uma única vez e mantém a ordem da API', async () => {
    const { wrapper } = await mountList()

    expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)
    expect(gamesService.listPaginated).toHaveBeenCalledWith(BASE)
    expect(gamesService.list).not.toHaveBeenCalled()
    expect(leaguesService.table).not.toHaveBeenCalled()
    expect(teamsService.list).toHaveBeenCalledWith({ league_id: 7 })
    const headers = wrapper.findAll('[data-test="games-table"] thead th').map((th) => th.text())
    expect(headers).toEqual(['Etapa', 'Confronto', 'Placar', 'Data', 'Status', ''])
    const rows = tableRows(wrapper)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('2ª rodada')
    expect(rows[0]).toContain('Bahia × Vitória')
    expect(rows[1]).toContain('1ª rodada')
    expect(rows[1]).toContain('Vitória × Bahia')
    expect(rows[1]).toContain('2 × 1')
    expect(rows[1]).toContain('05/04/2026 16:00')
    expect(rows[1]).toContain('Finalizada')
    expect(rows[2]).toContain('Final · Ida')
    expect(rows[2]).toContain('Sport Club do Recife × Bahia')
    expect(wrapper.find('[data-test="games-table"]').text()).toContain('1-20 de 45')
  })

  it('placar de jogo decidido nos pênaltis mostra os pênaltis entre parênteses', async () => {
    vi.mocked(gamesService.listPaginated).mockResolvedValue(
      makePage([
        makeGame(9, {
          league_id: 7,
          round: null,
          phase: 'Final',
          knockout_stage: 'F',
          home_score: 1,
          away_score: 1,
          home_penalties: 3,
          away_penalties: 4,
          status: 'finished',
        }),
      ]),
    )
    const { wrapper } = await mountList()

    expect(tableRows(wrapper)[0]).toContain('1 (3) × (4) 1')
  })

  it('itens por página não oferecem "Todos" (per_page=-1 daria 422)', async () => {
    const { wrapper } = await mountList()
    const footerSelect = wrapper
      .findComponent({ name: 'VDataTableFooter' })
      .findComponent({ name: 'VSelect' })

    const values = (footerSelect.props('items') as { value: number }[]).map((item) => item.value)
    expect(values).toEqual([10, 20, 50, 100])
  })

  it('filtro de status só é aplicado ao clicar em Buscar', async () => {
    const { wrapper } = await mountList()
    await choose(wrapper, 'VSelect', 'game-status-filter', 'finished')
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)

    await search(wrapper)
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(2)
    expect(lastQuery()).toEqual({ ...BASE, status: 'finished' })
  })

  it('filtro de time (mandante ou visitante) usa os times da liga', async () => {
    const { wrapper } = await mountList()
    const items = field(wrapper, 'VAutocomplete', 'game-team-filter').props('items')
    expect(items).toEqual([
      { value: 1, title: 'Vitória' },
      { value: 2, title: 'Bahia' },
    ])

    await choose(wrapper, 'VAutocomplete', 'game-team-filter', 2)
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)
    await search(wrapper)
    expect(lastQuery()).toEqual({ ...BASE, team_id: 2 })
  })

  it('filtro de rodada valida o número antes de buscar', async () => {
    const { wrapper } = await mountList()
    await choose(wrapper, 'VTextField', 'game-round-filter', '0')
    await search(wrapper)
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Informe uma rodada válida')

    await choose(wrapper, 'VTextField', 'game-round-filter', '3')
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)
    await search(wrapper)
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(2)
    expect(lastQuery()).toEqual({ ...BASE, round: 3 })
    expect(wrapper.text()).not.toContain('Informe uma rodada válida')
  })

  it.each([['hybrid' as const], ['knockout' as const]])(
    'filtro de fase (%s) usa as fases da tabela, sem repetir',
    async (format) => {
      vi.mocked(leaguesService.table).mockResolvedValue(
        phases(['Semifinal', 1], ['Semifinal', 1], ['Final', 2]),
      )
      const { wrapper } = await mountList(ALL, format)

      expect(leaguesService.table).toHaveBeenCalledWith(7)
      expect(field(wrapper, 'VSelect', 'game-phase-filter').props('items')).toEqual([
        'Semifinal',
        'Final',
      ])
      expect(wrapper.find('[data-test="game-round-filter"]').exists()).toBe(format === 'hybrid')

      await choose(wrapper, 'VSelect', 'game-phase-filter', 'Final')
      expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)
      await search(wrapper)
      expect(lastQuery()).toEqual({ ...BASE, phase: 'Final' })
    },
  )

  it('pontos corridos: sem fases não mostra o filtro de Fase', async () => {
    const { wrapper } = await mountList()

    expect(wrapper.find('[data-test="game-round-filter"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="game-phase-filter"]').exists()).toBe(false)
  })

  it('falha ao carregar a tabela não quebra a tela', async () => {
    vi.mocked(leaguesService.table).mockRejectedValue(apiError(500, 'Erro'))
    const { wrapper } = await mountList(ALL, 'hybrid')

    expect(wrapper.find('[data-test="game-phase-filter"]').exists()).toBe(false)
    expect(wrapper.find('.v-alert').exists()).toBe(false)
    expect(tableRows(wrapper)).toHaveLength(3)
  })

  it('trocar de página mantém só os filtros aplicados', async () => {
    const { wrapper } = await mountList()
    await choose(wrapper, 'VSelect', 'game-status-filter', 'finished')
    await search(wrapper)
    await choose(wrapper, 'VAutocomplete', 'game-team-filter', 2)

    await nextPage(wrapper)
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(3)
    expect(lastQuery()).toEqual({ ...BASE, page: 2, status: 'finished' })
  })

  it('Buscar na página 2 volta para a 1 com uma única requisição', async () => {
    const { wrapper } = await mountList()
    await nextPage(wrapper)
    expect(lastQuery()).toEqual({ ...BASE, page: 2 })

    await choose(wrapper, 'VSelect', 'game-status-filter', 'scheduled')
    await search(wrapper)
    expect(gamesService.listPaginated).toHaveBeenCalledTimes(3)
    expect(lastQuery()).toEqual({ ...BASE, status: 'scheduled' })
  })

  it('Buscar sem mudar nada recarrega a página atual uma vez', async () => {
    const { wrapper } = await mountList()
    await search(wrapper)

    expect(gamesService.listPaginated).toHaveBeenCalledTimes(2)
    expect(lastQuery()).toEqual(BASE)
  })

  it('com filtro aplicado e sem resultado, avisa que nada bate com os filtros', async () => {
    const { wrapper } = await mountList()
    vi.mocked(gamesService.listPaginated).mockResolvedValue(makePage([]))
    await choose(wrapper, 'VSelect', 'game-status-filter', 'cancelled')
    await search(wrapper)

    expect(wrapper.text()).toContain('Nenhuma partida encontrada com esses filtros.')
  })

  it('clicar na linha abre o detalhe da partida', async () => {
    const { wrapper, router } = await mountList()
    await wrapper.find('[data-test="games-table"] tbody tr').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-games-detail'))
    expect(router.currentRoute.value.params.id).toBe('2')
  })

  it.each([
    ['só leitura', ['game:read'], false],
    ['admin do seeder', ALL, true],
    ['game:all', ['game:all'], true],
  ])('ações por permissão: %s', async (_label, permissions, create) => {
    const { wrapper } = await mountList(permissions)
    expect(wrapper.find('[data-test="game-create"]').exists()).toBe(create)
    expect(wrapper.findAll('[data-test="game-view"]')).toHaveLength(3)
    expect(wrapper.find('[data-test="game-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="game-delete"]').exists()).toBe(false)
  })

  it.each([
    ['round_robin', 'As partidas de rodada desta liga são criadas pelo sorteio.'],
    [
      'hybrid',
      'As partidas de rodada desta liga são criadas pelo sorteio e as de mata-mata são geradas pela classificação.',
    ],
  ] as const)('liga com sorteio (%s): sem Nova partida e com o aviso', async (format, notice) => {
    const { wrapper } = await mountList(ALL, format, '', 'draw')

    expect(wrapper.find('[data-test="games-draw-notice"]').text()).toContain(notice)
    expect(wrapper.find('[data-test="games-draw-link"]').attributes('href')).toBe(
      '/admin/liga/7/sorteio',
    )
    expect(wrapper.find('[data-test="game-create"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'GameFormDialog' }).exists()).toBe(false)
  })

  it('liga manual não mostra o aviso do sorteio', async () => {
    const { wrapper } = await mountList()
    expect(wrapper.find('[data-test="games-draw-notice"]').exists()).toBe(false)
  })

  it('o olho abre o detalhe da partida com uma única navegação', async () => {
    const { wrapper, router } = await mountList(['game:read'])
    const view = wrapper.findAll('[data-test="game-view"]')[1]
    expect(view.attributes('aria-label')).toBe('Ver partida Vitória × Bahia')
    expect(view.attributes('href')).toBe('/admin/liga/7/partidas/1')
    const push = vi.spyOn(router, 'push')

    await view.trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-games-detail'))
    expect(router.currentRoute.value.params.id).toBe('1')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('filtros aplicados, página e itens por página vão para a querystring', async () => {
    const { wrapper, router } = await mountList()
    expect(router.currentRoute.value.query).toEqual({})

    await choose(wrapper, 'VSelect', 'game-status-filter', 'finished')
    expect(router.currentRoute.value.query).toEqual({})
    await search(wrapper)
    await nextPage(wrapper)
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ status: 'finished', page: '2' }),
    )

    wrapper
      .findComponent({ name: 'VDataTableFooter' })
      .findComponent({ name: 'VSelect' })
      .vm.$emit('update:modelValue', 50)
    await flushPromises()
    expect(lastQuery()).toEqual({ ...BASE, per_page: 50, status: 'finished' })
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ status: 'finished', per_page: '50' }),
    )
    expect(router.currentRoute.value.path).toBe('/admin/liga/7/partidas')
  })

  it('abre com os filtros e a página da querystring (voltar do detalhe)', async () => {
    const { wrapper } = await mountList(
      ALL,
      'hybrid',
      '?round=3&phase=Final&status=finished&team_id=2&page=2&per_page=10',
    )

    expect(gamesService.listPaginated).toHaveBeenCalledTimes(1)
    expect(lastQuery()).toEqual({
      league_id: 7,
      page: 2,
      per_page: 10,
      round: 3,
      phase: 'Final',
      status: 'finished',
      team_id: 2,
    })
    expect(field(wrapper, 'VTextField', 'game-round-filter').props('modelValue')).toBe(3)
    expect(field(wrapper, 'VSelect', 'game-status-filter').props('modelValue')).toBe('finished')
    expect(field(wrapper, 'VAutocomplete', 'game-team-filter').props('modelValue')).toBe(2)
    expect(wrapper.find('[data-test="games-table"]').text()).toContain('11-20 de 45')
  })

  it('ignora valores inválidos da querystring', async () => {
    const { router } = await mountList(
      ALL,
      'round_robin',
      '?round=abc&status=foo&team_id=-1&page=0&per_page=7',
    )

    expect(lastQuery()).toEqual(BASE)
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
  })

  it('pontos corridos: form pede Rodada e envia league_id da liga ativa', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9, { league_id: 7 }))
    const { wrapper, router } = await mountList()
    await openCreate(wrapper)

    expect(document.querySelector('[data-test="game-round"]')).not.toBeNull()
    expect(document.querySelector('[data-test="game-phase"]')).toBeNull()
    expect(document.querySelector('[data-test="game-stage-toggle"]')).toBeNull()
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await choose(wrapper, 'VTextField', 'game-round', '3')
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith({
      league_id: 7,
      home_team_id: 1,
      away_team_id: 2,
      stadium_id: null,
      match_date: null,
      status: 'scheduled',
      round: 3,
      phase: null,
      phase_order: null,
      tie_key: null,
      leg: null,
    })
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe('9'))
  })

  it('mata-mata: form pede Fase + Confronto + perna (sem Rodada)', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    vi.mocked(leaguesService.table).mockResolvedValue(phases(['Final', 3]))
    const { wrapper } = await mountList(ALL, 'knockout')
    await openCreate(wrapper)

    expect(document.querySelector('[data-test="game-round"]')).toBeNull()
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await choose(wrapper, 'VCombobox', 'game-phase', 'Final')
    await choose(wrapper, 'VTextField', 'game-tie-key', 'F')
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ round: null, phase: 'Final', phase_order: 3, tie_key: 'F', leg: null }),
    )
  })

  it('híbrido: alterna entre Rodada e Fase e nunca envia os dois', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    const { wrapper } = await mountList(ALL, 'hybrid')
    await openCreate(wrapper)

    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await choose(wrapper, 'VTextField', 'game-round', '4')
    await choose(wrapper, 'VBtnToggle', 'game-stage-toggle', 'phase')
    await choose(wrapper, 'VCombobox', 'game-phase', 'Semifinal')
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith(expect.objectContaining({ round: null, phase: 'Semifinal' }))
  })

  it('bloqueia mandante igual ao visitante e mostra erros 422 do backend', async () => {
    vi.mocked(gamesService.create).mockRejectedValue(
      apiError(422, 'Dados inválidos.', { phase: ['Informe a Fase desta partida (liga mata-mata).'] }),
    )
    const { wrapper } = await mountList(ALL, 'knockout')
    await openCreate(wrapper)

    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 1)
    await submit()
    expect(gamesService.create).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('O visitante deve ser diferente do mandante.')

    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await submit()
    expect(document.body.textContent).toContain('Informe a Fase desta partida (liga mata-mata).')
  })
})
