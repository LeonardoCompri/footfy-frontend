import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameEventFormDialog from '@/components/games/GameEventFormDialog.vue'
import { eventTypesService } from '@/services/api/eventTypes.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { useEventTypesStore } from '@/stores/eventTypes'
import type { GameResultsLock } from '@/types/game'
import type { EventTypeMeta, GameEvent, SummaryTeam } from '@/types/gameEvent'
import { createTestVuetify } from '@/test/utils'
import { defaultEventTypes, makeEvent, makeEventType, makePlayer } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))

const teams: SummaryTeam[] = [
  {
    id: 1,
    name: 'Vitória',
    side: 'home',
    players: [
      makePlayer(11, 'Renato', { team_id: 1, number: 9 }),
      makePlayer(12, 'Matheuzinho', { team_id: 1 }),
    ],
  },
  {
    id: 2,
    name: 'Bahia',
    side: 'away',
    players: [makePlayer(21, 'Everaldo', { team_id: 2 })],
  },
]

const removedEvent = makeEvent(5, {
  game_id: 7,
  team_id: 1,
  player_id: 99,
  related_player_id: 98,
  player: { id: 99, name: 'Zé Removido', removed: true },
  related_player: { id: 98, name: 'Assis Removido', removed: true },
  minute: 40,
})

async function loadTypes(types: EventTypeMeta[] = defaultEventTypes()) {
  vi.mocked(eventTypesService.list).mockResolvedValue(types)
  await useEventTypesStore().load()
}

function mountDialog(
  event: GameEvent | null,
  type = event?.type ?? 'goal',
  lock: GameResultsLock | null = null,
) {
  return mount(GameEventFormDialog, {
    props: { modelValue: true, gameId: 7, teams, type, event, lock },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
}

function field(wrapper: VueWrapper, test: string, name = 'VAutocomplete') {
  const found = wrapper.findAllComponents({ name }).find((c) => c.attributes('data-test') === test)
  if (!found) throw new Error(`${name}[data-test=${test}] não encontrado`)
  return found
}

async function choose(wrapper: VueWrapper, name: string, test: string, value: unknown) {
  field(wrapper, test, name).vm.$emit('update:modelValue', value)
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

const teamHint = () =>
  document.querySelector('[data-test="event-team"] .v-messages')?.textContent?.trim() ?? ''

function itemIds(wrapper: VueWrapper, test: string) {
  return (field(wrapper, test).props('items') as { id: number }[]).map((p) => p.id)
}

describe('GameEventFormDialog', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    await loadTypes()
  })

  it('na criação o tipo vem do card e o título traz o ícone e o nome do tipo', async () => {
    const wrapper = mountDialog(null, 'yellow_card')
    await flushPromises()

    const select = field(wrapper, 'event-type', 'VSelect')
    expect(select.props('modelValue')).toBe('yellow_card')
    expect(select.props('disabled')).toBe(false)
    expect(select.find('.v-select__selection').text()).toBe('Cartão amarelo')
    const title = document.querySelector('[data-test="event-form-title"]')!
    expect(title.textContent).toBe('Registrar Cartão amarelo')
    const icon = title.querySelector('.v-icon')!
    expect(icon.classList).toContain('mdi-card')
    expect(icon.classList).toContain('text-card-yellow')
  })

  it('cria com o tipo recebido, sem assistência quando o tipo não aceita', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, payload))
    const wrapper = mountDialog(null, 'red_card')
    await flushPromises()

    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    await submit()

    expect(gameEventsService.create).toHaveBeenCalledWith({
      game_id: 7,
      team_id: 1,
      player_id: 11,
      related_player_id: null,
      type: 'red_card',
      minute: null,
    })
  })

  it('na criação dá para trocar o tipo antes de salvar', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, payload))
    const wrapper = mountDialog(null, 'yellow_card')
    await flushPromises()

    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    await choose(wrapper, 'VSelect', 'event-type', 'goal')
    expect(document.querySelector('[data-test="event-form-title"]')!.textContent).toBe(
      'Registrar Gol',
    )
    expect(document.querySelector('[data-test="event-assist"]')).not.toBeNull()
    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    await choose(wrapper, 'VAutocomplete', 'event-assist', 12)
    await submit()

    expect(gameEventsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'goal', player_id: 11, related_player_id: 12 }),
    )
  })

  it('assistência e dica do time seguem as flags do tipo, não o slug', async () => {
    setActivePinia(createPinia())
    await loadTypes([
      ...defaultEventTypes(),
      makeEventType(5, 'penalty_goal', {
        name: 'Gol de pênalti',
        counts_for: 'team',
        allows_assist: true,
      }),
      makeEventType(6, 'wo', { name: 'W.O.', counts_for: 'opponent' }),
    ])

    const penalty = mountDialog(null, 'penalty_goal')
    await flushPromises()
    expect(document.querySelector('[data-test="event-assist"]')).not.toBeNull()
    expect(teamHint()).toBe('')
    penalty.unmount()

    document.body.innerHTML = ''
    mountDialog(null, 'wo')
    await flushPromises()
    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    expect(teamHint()).toBe('Time do jogador que fez o lance; o evento conta para o adversário.')
  })

  it('na edição o select "Tipo" traz os ativos e troca o tipo do evento', async () => {
    vi.mocked(gameEventsService.update).mockImplementation(async (id, payload) =>
      makeEvent(Number(id), payload),
    )
    const wrapper = mountDialog(
      makeEvent(6, { type: 'goal', team_id: 1, player_id: 11, related_player_id: 12 }),
    )
    await flushPromises()

    expect(document.querySelector('[data-test="event-form-title"]')!.textContent).toBe(
      'Editar evento',
    )
    const select = field(wrapper, 'event-type', 'VSelect')
    expect(select.props('modelValue')).toBe('goal')
    expect((select.props('items') as EventTypeMeta[]).map((t) => t.slug)).toEqual([
      'goal',
      'own_goal',
      'yellow_card',
      'red_card',
    ])
    expect(document.querySelector('[data-test="event-assist"]')).not.toBeNull()

    await choose(wrapper, 'VSelect', 'event-type', 'yellow_card')
    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    await choose(wrapper, 'VSelect', 'event-type', 'goal')
    expect(field(wrapper, 'event-assist').props('modelValue')).toBeNull()
    await choose(wrapper, 'VSelect', 'event-type', 'yellow_card')
    await submit()

    expect(gameEventsService.update).toHaveBeenCalledWith(
      6,
      expect.objectContaining({ type: 'yellow_card', player_id: 11, related_player_id: null }),
    )
  })

  it('na edição o tipo atual inativo continua na lista, marcado como inativo', async () => {
    setActivePinia(createPinia())
    await loadTypes([
      ...defaultEventTypes(),
      makeEventType(7, 'blue_card', { name: 'Cartão azul', active: false }),
    ])
    const wrapper = mountDialog(makeEvent(6, { type: 'blue_card', team_id: 1, player_id: 11 }))
    await flushPromises()

    const select = field(wrapper, 'event-type', 'VSelect')
    expect((select.props('items') as EventTypeMeta[]).map((t) => t.slug)).toEqual([
      'goal',
      'own_goal',
      'yellow_card',
      'red_card',
      'blue_card',
    ])
    expect(select.find('.v-select__selection').text()).toBe('Cartão azul (inativo)')
  })

  it('na edição, o jogador removido gravado aparece pelo nome com o selo "removido"', async () => {
    const wrapper = mountDialog(removedEvent)
    await flushPromises()

    for (const [test, name] of [
      ['event-player', 'Zé Removido'],
      ['event-assist', 'Assis Removido'],
    ]) {
      const autocomplete = field(wrapper, test)
      expect(autocomplete.find('.v-autocomplete__selection').text()).toBe(name)
      expect(autocomplete.find('.v-field__append-inner [data-test="removed-badge"]').text()).toBe(
        'removido',
      )
    }
  })

  it('a lista de opções marca o jogador removido com o selo', async () => {
    const wrapper = mountDialog(removedEvent)
    await flushPromises()

    await field(wrapper, 'event-player').find('.v-field').trigger('mousedown')
    await flushPromises()

    const options = [...document.querySelectorAll('.v-overlay--active [role="option"]')]
    expect(options.map((o) => o.textContent)).toEqual([
      '9 · Renato',
      'Matheuzinho',
      'Zé Removidoremovido',
    ])
    expect(options[2].querySelector('[data-test="removed-badge"]')).not.toBeNull()
    expect(options[0].querySelector('[data-test="removed-badge"]')).toBeNull()
  })

  it('só oferece o removido já gravado no próprio campo, nunca outro removido', async () => {
    const wrapper = mountDialog(removedEvent)
    await flushPromises()

    expect(itemIds(wrapper, 'event-player')).toEqual([11, 12, 99])
    expect(itemIds(wrapper, 'event-assist')).toEqual([11, 12, 98])

    wrapper
      .findAllComponents({ name: 'VSelect' })
      .find((c) => c.attributes('data-test') === 'event-team')!
      .vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(itemIds(wrapper, 'event-player')).toEqual([21])
  })

  it('evento com jogador ativo não mostra selo nem opção extra', async () => {
    const wrapper = mountDialog(
      makeEvent(6, {
        team_id: 1,
        player_id: 11,
        player: { id: 11, name: 'Renato', removed: false },
      }),
    )
    await flushPromises()

    expect(itemIds(wrapper, 'event-player')).toEqual([11, 12])
    expect(document.querySelector('[data-test="removed-badge"]')).toBeNull()
  })

  it('mantém o jogador removido ao salvar a edição de outro campo', async () => {
    vi.mocked(gameEventsService.update).mockImplementation(async (id, payload) =>
      makeEvent(Number(id), payload),
    )
    const wrapper = mountDialog(removedEvent)
    await flushPromises()

    wrapper
      .findAllComponents({ name: 'VTextField' })
      .find((c) => c.attributes('data-test') === 'event-minute')!
      .vm.$emit('update:modelValue', '41')
    await flushPromises()
    ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(gameEventsService.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ player_id: 99, related_player_id: 98, minute: 41 }),
    )
  })

  it.each([
    ['group_stage', 'goal', true],
    ['group_stage', 'yellow_card', true],
    ['next_stage', 'goal', true],
    ['next_stage', 'own_goal', true],
    ['next_stage', 'yellow_card', false],
    [null, 'goal', false],
  ] as const)(
    'trava %s, evento %s: tipo e time desabilitados na edição = %s',
    async (lock, type, disabled) => {
      const wrapper = mountDialog(
        makeEvent(3, { game_id: 7, type, team_id: 1, player_id: 11 }),
        type,
        lock,
      )
      await flushPromises()

      expect(field(wrapper, 'event-type', 'VSelect').props('disabled')).toBe(disabled)
      expect(field(wrapper, 'event-team', 'VSelect').props('disabled')).toBe(disabled)
      expect(field(wrapper, 'event-player').props('disabled')).toBe(false)
      expect(field(wrapper, 'event-minute', 'VTextField').props('disabled')).toBeFalsy()
    },
  )

  it.each([
    ['criação', null, ['event-minute', 'event-type', 'event-team', 'event-player', 'event-assist']],
    [
      'edição',
      makeEvent(6, { type: 'goal', team_id: 1, player_id: 11 }),
      ['event-minute', 'event-type', 'event-team', 'event-player', 'event-assist'],
    ],
  ])('na %s os campos seguem a ordem da folha', async (_label, event, order) => {
    mountDialog(event, 'goal')
    await flushPromises()

    const fields = [
      ...document.querySelectorAll('[data-test="form-content"] [data-test^="event-"]'),
    ]
    expect(fields.map((el) => el.getAttribute('data-test'))).toEqual(order)
  })

  it('o minuto abre com foco e explica a contagem corrida', async () => {
    const wrapper = mountDialog(null, 'goal')
    await flushPromises()

    const minute = field(wrapper, 'event-minute', 'VTextField')
    expect(minute.props('autofocus')).toBe(true)
    expect(minute.props('hint')).toBe('Minuto corrido: o 2º tempo continua em 46, 47…')
  })

  it('o time aparece como mandante ou visitante', async () => {
    const wrapper = mountDialog(null, 'goal')
    await flushPromises()

    await field(wrapper, 'event-team', 'VSelect').find('.v-field').trigger('mousedown')
    await flushPromises()
    const options = [...document.querySelectorAll('.v-overlay--active .v-list-item')]
    expect(options.map((o) => o.textContent)).toEqual(['Mandante · Vitória', 'Visitante · Bahia'])

    await choose(wrapper, 'VSelect', 'event-team', 2)
    expect(field(wrapper, 'event-team', 'VSelect').find('.v-select__selection').text()).toBe(
      'Visitante · Bahia',
    )
  })

  describe('busca do jogador', () => {
    const squad: SummaryTeam[] = [
      {
        id: 1,
        name: 'Vitória',
        side: 'home',
        players: [
          makePlayer(31, 'Ana Lima', { team_id: 1, number: 1 }),
          makePlayer(32, 'Diego Ramos', { team_id: 1, number: 10 }),
          makePlayer(33, 'Bruno Dias', { team_id: 1, number: 11 }),
          makePlayer(34, 'Carla Souza', { team_id: 1, number: 21 }),
          makePlayer(35, 'Sem Número', { team_id: 1 }),
        ],
      },
      teams[1],
    ]

    async function mountWithSquad(type = 'goal') {
      const wrapper = mountDialog(null, type)
      await wrapper.setProps({ teams: squad })
      await choose(wrapper, 'VSelect', 'event-team', 1)
      return wrapper
    }

    async function search(wrapper: VueWrapper, test: string, text: string) {
      const input = field(wrapper, test).find('input')
      await input.trigger('focus')
      await input.setValue(text)
      await flushPromises()
      return [...document.querySelectorAll('.v-overlay--active [role="option"]')].map(
        (o) => o.textContent,
      )
    }

    it('digitar o nº acha só a camisa exata', async () => {
      const wrapper = await mountWithSquad()

      expect(await search(wrapper, 'event-player', '1')).toEqual(['1 · Ana Lima'])
      expect(await search(wrapper, 'event-player', '10')).toEqual(['10 · Diego Ramos'])
      expect(await search(wrapper, 'event-player', ' 21 ')).toEqual(['21 · Carla Souza'])
    })

    it('continua buscando pelo nome', async () => {
      const wrapper = await mountWithSquad()

      expect(await search(wrapper, 'event-player', 'dI')).toEqual([
        '10 · Diego Ramos',
        '11 · Bruno Dias',
      ])
      expect(await search(wrapper, 'event-player', 'número')).toEqual(['Sem Número'])
    })

    it('nº sem atleta no time avisa que não achou', async () => {
      const wrapper = await mountWithSquad()

      expect(await search(wrapper, 'event-player', '7')).toEqual([])
      expect(document.querySelector('.v-menu.v-overlay--active')?.textContent).toBe(
        'Nenhum jogador com esse nº ou nome neste time.',
      )
    })

    it('Tab depois do nº seleciona o atleta, também na assistência', async () => {
      const wrapper = await mountWithSquad()

      await search(wrapper, 'event-player', '10')
      await field(wrapper, 'event-player').find('input').trigger('keydown', { key: 'Tab' })
      await flushPromises()
      expect(field(wrapper, 'event-player').props('modelValue')).toBe(32)

      expect(await search(wrapper, 'event-assist', '11')).toEqual(['11 · Bruno Dias'])
      await field(wrapper, 'event-assist').find('input').trigger('keydown', { key: 'Tab' })
      await flushPromises()
      expect(field(wrapper, 'event-assist').props('modelValue')).toBe(33)
    })
  })

  it('mostra a sigla do tipo quando o back envia, sem depender dela', async () => {
    setActivePinia(createPinia())
    await loadTypes([
      makeEventType(1, 'goal', { name: 'Gol', abbreviation: 'G' }),
      makeEventType(3, 'yellow_card', { name: 'Cartão amarelo', abbreviation: null }),
    ])
    const wrapper = mountDialog(makeEvent(6, { type: 'goal', team_id: 1, player_id: 11 }))
    await flushPromises()

    const select = field(wrapper, 'event-type', 'VSelect')
    expect(select.find('.v-select__selection').text()).toBe('G · Gol')
    await select.find('.v-field').trigger('mousedown')
    await flushPromises()
    const options = [...document.querySelectorAll('.v-overlay--active .v-list-item-title')]
    expect(options.map((o) => o.textContent)).toEqual(['G · Gol', 'Cartão amarelo'])
  })

  it('fase seguinte gerada: ao lançar um cartão o tipo só oferece os que não são de placar', async () => {
    const wrapper = mountDialog(null, 'yellow_card', 'next_stage')
    await flushPromises()

    const select = field(wrapper, 'event-type', 'VSelect')
    expect(select.props('modelValue')).toBe('yellow_card')
    expect(select.props('disabled')).toBe(false)
    expect((select.props('items') as EventTypeMeta[]).map((t) => t.slug)).toEqual([
      'yellow_card',
      'red_card',
    ])
  })

  it('fase seguinte gerada: o gol editado continua no select, travado', async () => {
    const wrapper = mountDialog(
      makeEvent(3, { game_id: 7, type: 'goal', team_id: 1, player_id: 11 }),
      'goal',
      'next_stage',
    )
    await flushPromises()

    const select = field(wrapper, 'event-type', 'VSelect')
    expect(select.props('disabled')).toBe(true)
    expect(select.find('.v-select__selection').text()).toBe('Gol')
    expect((select.props('items') as EventTypeMeta[]).map((t) => t.slug)).toEqual([
      'yellow_card',
      'red_card',
      'goal',
    ])
  })

  it('na criação a trava não desabilita o tipo nem o time', async () => {
    const wrapper = mountDialog(null, 'goal', 'group_stage')
    await flushPromises()
    expect(field(wrapper, 'event-type', 'VSelect').props('disabled')).toBeFalsy()
    expect(field(wrapper, 'event-team', 'VSelect').props('disabled')).toBeFalsy()
  })
})
