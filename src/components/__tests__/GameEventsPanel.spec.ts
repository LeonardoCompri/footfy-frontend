import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameEventsPanel from '@/components/games/GameEventsPanel.vue'
import { eventTypesService } from '@/services/api/eventTypes.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { teamsService } from '@/services/api/teams.service'
import { useAuthStore } from '@/stores/auth'
import type { Game } from '@/types/game'
import type { GameEvent } from '@/types/gameEvent'
import { createTestVuetify, makeUser } from '@/test/utils'
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
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: { get: vi.fn() },
}))

const ALL = ['game_event:create', 'game_event:update', 'game_event:delete']

const homeTeam = makeTeam(1, 'Esporte Clube Vitória', {
  nickname: 'Vitória',
  players: [
    makePlayer(12, 'Matheuzinho', { team_id: 1 }),
    makePlayer(11, 'Renato', { team_id: 1, number: 9 }),
  ],
})
const awayTeam = makeTeam(2, 'Esporte Clube Bahia', {
  nickname: 'Bahia',
  players: [makePlayer(21, 'Everaldo', { team_id: 2 })],
})

const defaultEvents = () => [
  makeEvent(2, {
    game_id: 7,
    type: 'yellow_card',
    team_id: 2,
    player_id: 21,
    player: { id: 21, name: 'Everaldo', removed: false },
    minute: 60,
  }),
  makeEvent(1, {
    game_id: 7,
    type: 'goal',
    team_id: 1,
    player_id: 11,
    related_player_id: 12,
    player: { id: 11, name: 'Renato', removed: false },
    related_player: { id: 12, name: 'Matheuzinho', removed: false },
    minute: 30,
  }),
]

function gameWith(events: GameEvent[] = defaultEvents(), extra: Partial<Game> = {}) {
  return makeGame(7, { homeTeam, awayTeam, events, ...extra })
}

async function mountPanel(permissions: string[] = ALL, game: Game = gameWith()) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser('admin', permissions)
  const wrapper = mount(GameEventsPanel, {
    props: { game },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
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

function rows(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-test="event-row"]')
    .map((row) => `${row.find('.minute').text()} ${row.find('[data-test="event-player"]').text()}`)
}

function actionLabels(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="event-action"]').map((card) => card.text())
}

async function openCreate(wrapper: VueWrapper, typeName = 'Gol') {
  const card = wrapper.findAll('[data-test="event-action"]').find((c) => c.text() === typeName)
  if (!card) throw new Error(`card do tipo "${typeName}" não encontrado`)
  await card.trigger('click')
  await flushPromises()
}

function formOpen() {
  return document.querySelector('.v-dialog.v-overlay--active [data-test="event-team"]') !== null
}

function formTitle() {
  return document.querySelector('.v-dialog.v-overlay--active [data-test="event-form-title"]')
    ?.textContent
}

describe('GameEventsPanel (Súmula)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(eventTypesService.list).mockResolvedValue(defaultEventTypes())
  })

  it('mostra os eventos da partida, buscando só os tipos de evento', async () => {
    const wrapper = await mountPanel()

    expect(eventTypesService.list).toHaveBeenCalledTimes(1)
    expect(gameEventsService.list).not.toHaveBeenCalled()
    expect(teamsService.get).not.toHaveBeenCalled()

    const rows = wrapper.findAll('[data-test="event-row"]').map((r) => r.text())
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain("60'")
    expect(rows[0]).toContain('Everaldo')
    expect(rows[0]).toContain('Cartão amarelo · Bahia')
    expect(rows[1]).toContain("30'")
    expect(rows[1]).toContain('Renato')
    expect(rows[1]).toContain('Gol · Vitória')
    expect(rows[1]).toContain('Assistência: Matheuzinho')
  })

  it('ordena do minuto mais alto para o mais baixo, sem minuto no fim e empate pelo id mais recente', async () => {
    const event = (id: number, minute: number | null, name: string) =>
      makeEvent(id, {
        game_id: 7,
        team_id: 1,
        player_id: 11,
        player: { id: 11, name, removed: false },
        minute,
      })
    const game = gameWith([
      event(1, 15, 'Primeiro aos 15'),
      event(2, 18, 'Aos 18'),
      event(3, 10, 'Aos 10'),
      event(4, null, 'Sem minuto'),
      event(5, 15, 'Segundo aos 15'),
    ])
    const wrapper = await mountPanel(ALL, game)

    expect(rows(wrapper)).toEqual([
      "18' Aos 18",
      "15' Segundo aos 15",
      "15' Primeiro aos 15",
      "10' Aos 10",
      '— Sem minuto',
    ])
    expect(game.events!.map((e) => e.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('evento novo entra na posição do minuto quando a tela recarrega a partida', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, payload))
    const wrapper = await mountPanel()
    await openCreate(wrapper, 'Cartão amarelo')
    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    await choose(wrapper, 'VTextField', 'event-minute', '45')
    await submit()

    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(rows(wrapper)).toEqual(["60' Everaldo", "30' Renato"])

    const created = makeEvent(9, {
      game_id: 7,
      type: 'yellow_card',
      team_id: 1,
      player_id: 11,
      player: { id: 11, name: 'Renato', removed: false },
      minute: 45,
    })
    await wrapper.setProps({ game: gameWith([...defaultEvents(), created]) })

    expect(rows(wrapper)).toEqual(["60' Everaldo", "45' Renato", "30' Renato"])
  })

  it('evento editado muda de posição quando a tela recarrega a partida', async () => {
    vi.mocked(gameEventsService.update).mockImplementation(async (id, payload) =>
      makeEvent(Number(id), payload),
    )
    const wrapper = await mountPanel()
    await wrapper.findAll('[data-test="event-edit"]')[1].trigger('click')
    await flushPromises()
    await choose(wrapper, 'VTextField', 'event-minute', '75')
    await submit()

    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(rows(wrapper)).toEqual(["60' Everaldo", "30' Renato"])

    const [yellow, goal] = defaultEvents()
    await wrapper.setProps({ game: gameWith([yellow, { ...goal, minute: 75 }]) })

    expect(rows(wrapper)).toEqual(["75' Renato", "60' Everaldo"])
  })

  it('sem eventos mostra o estado vazio', async () => {
    const wrapper = await mountPanel(ALL, gameWith([]))
    expect(wrapper.find('[data-test="events-empty"]').exists()).toBe(true)
  })

  it('gol contra tem rótulo e cor próprios, com o time do jogador que fez o gol', async () => {
    const wrapper = await mountPanel(
      ALL,
      gameWith([
        makeEvent(3, {
          game_id: 7,
          type: 'own_goal',
          team_id: 2,
          player_id: 21,
          player: { id: 21, name: 'Everaldo', removed: false },
          minute: 75,
        }),
        ...defaultEvents(),
      ]),
    )

    const [ownGoal] = wrapper.findAll('[data-test="event-row"]')
    expect(ownGoal.find('[data-test="event-subtitle"]').text()).toBe('Gol contra · Bahia')
    expect(ownGoal.find('[data-test="event-assist-line"]').exists()).toBe(false)
    const icon = ownGoal.find('.v-icon')
    expect(icon.attributes('aria-label')).toBe('Gol contra')
    expect(icon.classes()).toContain('text-error')
    const goalIcon = wrapper.findAll('[data-test="event-row"]')[2].find('.v-icon')
    expect(goalIcon.attributes('aria-label')).toBe('Gol')
    expect(goalIcon.classes()).not.toContain('text-error')
  })

  it('jogador removido do elenco aparece pelo nome do evento com o selo "removido"', async () => {
    const wrapper = await mountPanel(
      ALL,
      gameWith([
        makeEvent(1, {
          game_id: 7,
          team_id: 1,
          player_id: 99,
          related_player_id: 98,
          player: { id: 99, name: 'Zé Removido', removed: true },
          related_player: { id: 98, name: 'Assis Removido', removed: true },
          minute: 10,
        }),
        makeEvent(2, {
          game_id: 7,
          team_id: 1,
          player_id: 11,
          related_player_id: null,
          player: { id: 11, name: 'Renato', removed: false },
          related_player: null,
          minute: 20,
        }),
      ]),
    )

    const [active, removed] = wrapper.findAll('[data-test="event-row"]')
    expect(removed.find('[data-test="event-player"] .text-truncate').text()).toBe('Zé Removido')
    expect(removed.find('[data-test="event-player"] [data-test="removed-badge"]').exists()).toBe(
      true,
    )
    expect(removed.find('[data-test="event-subtitle"]').text()).toBe('Gol · Vitória')
    expect(removed.find('[data-test="event-assist-line"]').classes()).toContain('d-block')
    expect(removed.find('[data-test="event-assist-line"]').text()).toBe(
      'Assistência: Assis Removido removido',
    )
    expect(
      removed.find('[data-test="event-assist-line"] [data-test="removed-badge"]').exists(),
    ).toBe(true)
    expect(removed.findAll('[data-test="removed-badge"]')).toHaveLength(2)
    expect(active.find('[data-test="event-player"]').text()).toBe('Renato')
    expect(active.find('[data-test="removed-badge"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Jogador fora do elenco')
  })

  it('sem a relação carregada, procura o nome no elenco da partida', async () => {
    const wrapper = await mountPanel(
      ALL,
      gameWith([
        makeEvent(1, { game_id: 7, team_id: 1, player_id: 11, related_player_id: 55, minute: 10 }),
      ]),
    )

    const row = wrapper.find('[data-test="event-row"]')
    expect(row.find('[data-test="event-player"]').text()).toBe('Renato')
    expect(row.find('[data-test="event-assist-line"]').text()).toBe(
      'Assistência: Jogador fora do elenco',
    )
    expect(row.find('[data-test="removed-badge"]').exists()).toBe(false)
  })

  it('sem a relação e sem elencos mostra o texto de fora do elenco', async () => {
    const wrapper = await mountPanel(
      ALL,
      gameWith([makeEvent(1, { game_id: 7, team_id: 1, player_id: 11, minute: 10 })], {
        homeTeam: makeTeam(1, 'Esporte Clube Vitória', { nickname: 'Vitória' }),
        awayTeam: makeTeam(2, 'Esporte Clube Bahia', { nickname: 'Bahia' }),
      }),
    )

    const row = wrapper.find('[data-test="event-row"]')
    expect(row.find('[data-test="event-player"]').text()).toBe('Jogador fora do elenco')
    expect(row.find('[data-test="event-subtitle"]').text()).toBe('Gol · Vitória')
  })

  it('a grade traz um botão por tipo ativo, na ordem do backend', async () => {
    const [goal, ...others] = defaultEventTypes()
    vi.mocked(eventTypesService.list).mockResolvedValue([
      goal,
      makeEventType(5, 'penalty_goal', {
        name: 'Gol de pênalti',
        counts_for: 'team',
        sort_order: 1,
      }),
      makeEventType(6, 'old_card', { name: 'Cartão azul', sort_order: 1, active: false }),
      ...others,
    ])
    const wrapper = await mountPanel()

    expect(actionLabels(wrapper)).toEqual([
      'Gol',
      'Gol de pênalti',
      'Gol contra',
      'Cartão amarelo',
      'Cartão vermelho',
    ])
    const [goalCard] = wrapper.findAllComponents({ name: 'ActionCard' })
    expect(goalCard.props()).toMatchObject({ icon: 'mdi-soccer', color: 'primary' })
  })

  it('mostra o skeleton enquanto os tipos carregam e bloqueia a edição', async () => {
    let resolve!: (value: ReturnType<typeof defaultEventTypes>) => void
    vi.mocked(eventTypesService.list).mockReturnValue(new Promise((r) => (resolve = r)))
    const wrapper = await mountPanel()

    expect(wrapper.find('[data-test="event-actions-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="event-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="event-edit"]').attributes('disabled')).toBeDefined()

    resolve(defaultEventTypes())
    await flushPromises()
    expect(wrapper.find('[data-test="event-actions-loading"]').exists()).toBe(false)
    expect(actionLabels(wrapper)).toHaveLength(4)
    expect(wrapper.find('[data-test="event-edit"]').attributes('disabled')).toBeUndefined()
  })

  it('erro ao carregar os tipos mostra o alerta e "Tentar de novo" busca outra vez', async () => {
    vi.mocked(eventTypesService.list).mockRejectedValueOnce(apiError(500, 'Erro no servidor'))
    const wrapper = await mountPanel()

    const alert = wrapper.find('[data-test="event-types-error"]')
    expect(alert.text()).toContain('Não foi possível carregar os tipos de evento: Erro no servidor')
    expect(wrapper.find('[data-test="event-action"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="event-row"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="event-edit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-test="event-types-retry"]').trigger('click')
    await flushPromises()

    expect(eventTypesService.list).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="event-types-error"]').exists()).toBe(false)
    expect(actionLabels(wrapper)).toHaveLength(4)
  })

  it('sem tipos ativos avisa que não há o que registrar', async () => {
    vi.mocked(eventTypesService.list).mockResolvedValue([
      makeEventType(1, 'goal', { name: 'Gol', active: false }),
    ])
    const wrapper = await mountPanel()

    expect(wrapper.find('[data-test="event-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="event-actions-empty"]').exists()).toBe(true)
  })

  it('evento de tipo desconhecido aparece pelo slug com o ícone de ajuda e não conta gol', async () => {
    const wrapper = await mountPanel(
      ALL,
      gameWith(
        [
          makeEvent(3, {
            game_id: 7,
            type: 'penalty_goal',
            team_id: 1,
            player_id: 11,
            player: { id: 11, name: 'Renato', removed: false },
            minute: 5,
          }),
        ],
        { status: 'finished', home_score: 0, away_score: 0 },
      ),
    )

    const row = wrapper.find('[data-test="event-row"]')
    expect(row.find('[data-test="event-subtitle"]').text()).toBe('penalty_goal · Vitória')
    const icon = row.find('.v-icon')
    expect(icon.classes()).toEqual(expect.arrayContaining(['mdi-help-circle-outline', 'text-grey']))
    expect(icon.attributes('aria-label')).toBe('penalty_goal')
    expect(wrapper.find('[data-test="score-mismatch"]').exists()).toBe(false)
  })

  it('tipo novo que conta para o time entra na conferência do placar', async () => {
    vi.mocked(eventTypesService.list).mockResolvedValue([
      ...defaultEventTypes(),
      makeEventType(5, 'penalty_goal', { name: 'Gol de pênalti', counts_for: 'team' }),
    ])
    const penalty = makeEvent(3, { game_id: 7, type: 'penalty_goal', team_id: 2, player_id: 21 })
    const wrapper = await mountPanel(
      ALL,
      gameWith([penalty, ...defaultEvents()], {
        status: 'finished',
        home_score: 2,
        away_score: 2,
      }),
    )

    expect(wrapper.find('[data-test="score-mismatch"]').text()).toContain('(1 × 1)')
  })

  it('clicar no tipo abre o formulário dele, com o elenco vindo da partida', async () => {
    const wrapper = await mountPanel()
    await openCreate(wrapper, 'Cartão amarelo')

    expect(formOpen()).toBe(true)
    expect(formTitle()).toBe('Registrar Cartão amarelo')
    expect(teamsService.get).not.toHaveBeenCalled()
    expect(field(wrapper, 'VSelect', 'event-team').props('items')).toEqual([
      { id: 1, name: 'Vitória', players: [homeTeam.players![1], homeTeam.players![0]] },
      { id: 2, name: 'Bahia', players: awayTeam.players },
    ])
    expect(document.querySelector('.v-overlay--active [data-test="event-type"]')).toBeNull()
    expect(document.querySelector('.v-overlay--active [data-test="event-assist"]')).toBeNull()
    expect(field(wrapper, 'VAutocomplete', 'event-player').props('disabled')).toBe(true)
    await choose(wrapper, 'VSelect', 'event-team', 2)
    const players = field(wrapper, 'VAutocomplete', 'event-player').props('items') as {
      id: number
    }[]
    expect(players.map((p) => p.id)).toEqual([21])
  })

  it('registra gol com assistência opcional e avisa a tela para recarregar a partida', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) =>
      makeEvent(9, { ...payload, league_id: 1 }),
    )
    const wrapper = await mountPanel()
    await openCreate(wrapper)

    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    const assists = field(wrapper, 'VAutocomplete', 'event-assist').props('items') as {
      id: number
    }[]
    expect(assists.map((p) => p.id)).toEqual([12])
    await choose(wrapper, 'VAutocomplete', 'event-assist', 12)
    await choose(wrapper, 'VTextField', 'event-minute', '88')
    await submit()

    expect(gameEventsService.create).toHaveBeenCalledWith({
      game_id: 7,
      team_id: 1,
      player_id: 11,
      related_player_id: 12,
      type: 'goal',
      minute: 88,
    })
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('gol contra não tem assistência e explica de que time é o jogador', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, payload))
    const wrapper = await mountPanel()
    await openCreate(wrapper, 'Gol contra')

    expect(formTitle()).toBe('Registrar Gol contra')
    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    expect(document.body.textContent).toContain(
      'Time do jogador que fez o lance; o evento conta para o adversário.',
    )
    await choose(wrapper, 'VSelect', 'event-team', 2)
    await choose(wrapper, 'VAutocomplete', 'event-player', 21)
    await submit()

    expect(gameEventsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'own_goal',
        team_id: 2,
        player_id: 21,
        related_player_id: null,
      }),
    )
  })

  it('cartão é registrado sem assistência e sem dica no time', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, payload))
    const wrapper = await mountPanel()
    await openCreate(wrapper, 'Cartão vermelho')

    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    expect(document.body.textContent).not.toContain('conta para o adversário')
    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    await submit()

    expect(gameEventsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'red_card',
        player_id: 11,
        related_player_id: null,
        minute: null,
      }),
    )
  })

  it('não envia sem time e jogador', async () => {
    const wrapper = await mountPanel()
    await openCreate(wrapper)
    await submit()

    expect(gameEventsService.create).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Selecione o time.')
    expect(document.body.textContent).toContain('Selecione o jogador.')
  })

  it('editar abre o formulário preenchido, sem buscar elencos, e avisa a tela ao salvar', async () => {
    vi.mocked(gameEventsService.update).mockImplementation(async (id, payload) =>
      makeEvent(Number(id), payload),
    )
    const wrapper = await mountPanel()
    await wrapper.findAll('[data-test="event-edit"]')[1].trigger('click')
    await flushPromises()

    expect(teamsService.get).not.toHaveBeenCalled()
    expect(formTitle()).toBe('Editar evento')
    expect(field(wrapper, 'VSelect', 'event-type').props('modelValue')).toBe('goal')
    expect(field(wrapper, 'VAutocomplete', 'event-player').props('modelValue')).toBe(11)
    await choose(wrapper, 'VTextField', 'event-minute', '31')
    await submit()

    expect(gameEventsService.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ minute: 31, related_player_id: 12 }),
    )
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('exclui um evento após confirmar e avisa a tela', async () => {
    vi.mocked(gameEventsService.remove).mockResolvedValue({} as never)
    const wrapper = await mountPanel()
    await wrapper.findAll('[data-test="event-delete"]')[0].trigger('click')
    await flushPromises()
    const confirm = [...document.querySelectorAll('.v-overlay--active button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(gameEventsService.remove).toHaveBeenCalledWith(2)
    expect(teamsService.get).not.toHaveBeenCalled()
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('falha ao excluir não avisa a tela', async () => {
    vi.mocked(gameEventsService.remove).mockRejectedValue(apiError(500, 'Erro no servidor'))
    const wrapper = await mountPanel()
    await wrapper.findAll('[data-test="event-delete"]')[0].trigger('click')
    await flushPromises()
    const confirm = [...document.querySelectorAll('.v-overlay--active button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it.each([
    ['sem permissões de súmula', [] as string[], [false, false, false]],
    ['só criar', ['game_event:create'], [true, false, false]],
    ['game_event:all', ['game_event:all'], [true, true, true]],
  ])('botões por permissão: %s', async (_label, permissions, [create, edit, del]) => {
    const wrapper = await mountPanel(permissions)
    expect(wrapper.find('[data-test="event-actions"]').exists()).toBe(create)
    expect(wrapper.find('[data-test="event-action"]').exists()).toBe(create)
    expect(wrapper.find('[data-test="event-edit"]').exists()).toBe(edit)
    expect(wrapper.find('[data-test="event-delete"]').exists()).toBe(del)
  })

  it.each([
    [true, 'jogo de grupo com mata-mata gerado'],
    [false, 'sem trava'],
  ])('results_locked %s (%s): lançar e excluir somem, editar fica', async (locked) => {
    const wrapper = await mountPanel(ALL, gameWith(defaultEvents(), { results_locked: locked }))
    expect(wrapper.find('[data-test="events-locked"]').exists()).toBe(locked)
    expect(wrapper.find('[data-test="event-actions"]').exists()).toBe(!locked)
    expect(wrapper.find('[data-test="event-delete"]').exists()).toBe(!locked)
    expect(wrapper.findAll('[data-test="event-edit"]')).toHaveLength(2)
  })

  it('o aviso da trava explica o que ainda dá para corrigir', async () => {
    const wrapper = await mountPanel(ALL, gameWith(defaultEvents(), { results_locked: true }))
    expect(wrapper.find('[data-test="events-locked"]').text()).toBe(
      'Os resultados da fase de grupos estão travados porque o mata-mata já foi gerado. Para corrigir, desfaça o mata-mata. Ainda dá para corrigir o jogador e o minuto dos eventos lançados.',
    )
  })

  it('jogo travado: a edição só libera jogador, assistência e minuto e envia o mesmo tipo e time', async () => {
    vi.mocked(gameEventsService.update).mockImplementation(async (id, payload) =>
      makeEvent(Number(id), payload),
    )
    const wrapper = await mountPanel(ALL, gameWith(defaultEvents(), { results_locked: true }))
    await wrapper.findAll('[data-test="event-edit"]')[1].trigger('click')
    await flushPromises()

    expect(field(wrapper, 'VSelect', 'event-type').props('disabled')).toBe(true)
    expect(field(wrapper, 'VSelect', 'event-team').props('disabled')).toBe(true)
    expect(field(wrapper, 'VAutocomplete', 'event-player').props('disabled')).toBe(false)
    expect(field(wrapper, 'VAutocomplete', 'event-assist').props('disabled')).toBe(false)
    expect(field(wrapper, 'VTextField', 'event-minute').props('disabled')).toBeFalsy()

    await choose(wrapper, 'VAutocomplete', 'event-player', 12)
    await choose(wrapper, 'VTextField', 'event-minute', '33')
    await submit()

    expect(gameEventsService.update).toHaveBeenCalledWith(1, {
      game_id: 7,
      team_id: 1,
      player_id: 12,
      related_player_id: null,
      type: 'goal',
      minute: 33,
    })
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('jogo travado: o 422 do back aparece no formulário de edição', async () => {
    const message =
      'Os resultados da fase de grupos estão travados porque o mata-mata já foi gerado. Para corrigir, desfaça o mata-mata.'
    vi.mocked(gameEventsService.update).mockRejectedValue(apiError(422, message))
    const wrapper = await mountPanel(ALL, gameWith(defaultEvents(), { results_locked: true }))
    await wrapper.findAll('[data-test="event-edit"]')[1].trigger('click')
    await flushPromises()
    await choose(wrapper, 'VTextField', 'event-minute', '33')
    await submit()

    expect(document.querySelector('[data-test="form-error"]')?.textContent).toContain(message)
    expect(formOpen()).toBe(true)
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('avisa quando os gols da súmula não batem com o placar finalizado', async () => {
    const wrapper = await mountPanel(
      ALL,
      gameWith(defaultEvents(), { status: 'finished', home_score: 2, away_score: 0 }),
    )
    expect(wrapper.find('[data-test="score-mismatch"]').text()).toContain('(1 × 0)')
  })

  it('gol contra conta para o adversário na conferência do placar', async () => {
    const ownGoal = makeEvent(3, {
      game_id: 7,
      type: 'own_goal',
      team_id: 2,
      player_id: 21,
      minute: 80,
    })
    const matching = await mountPanel(
      ALL,
      gameWith([ownGoal, ...defaultEvents()], { status: 'finished', home_score: 2, away_score: 0 }),
    )
    expect(matching.find('[data-test="score-mismatch"]').exists()).toBe(false)
    matching.unmount()

    const mismatch = await mountPanel(
      ALL,
      gameWith([ownGoal, ...defaultEvents()], { status: 'finished', home_score: 1, away_score: 1 }),
    )
    expect(mismatch.find('[data-test="score-mismatch"]').text()).toContain('(2 × 0)')
  })
})
