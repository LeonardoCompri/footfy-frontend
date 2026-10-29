import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameEventFormDialog from '@/components/games/GameEventFormDialog.vue'
import { gameEventsService } from '@/services/api/gameEvents.service'
import type { GameEvent, SummaryTeam } from '@/types/gameEvent'
import { createTestVuetify } from '@/test/utils'
import { makeEvent, makePlayer } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { create: vi.fn(), update: vi.fn() },
}))

const teams: SummaryTeam[] = [
  {
    id: 1,
    name: 'Vitória',
    players: [
      makePlayer(11, 'Renato', { team_id: 1, number: 9 }),
      makePlayer(12, 'Matheuzinho', { team_id: 1 }),
    ],
  },
  { id: 2, name: 'Bahia', players: [makePlayer(21, 'Everaldo', { team_id: 2 })] },
]

// Autor e assistência removidos do elenco (soft delete): não estão em `teams[].players`.
const removedEvent = makeEvent(5, {
  game_id: 7,
  team_id: 1,
  player_id: 99,
  related_player_id: 98,
  player: { id: 99, name: 'Zé Removido', removed: true },
  related_player: { id: 98, name: 'Assis Removido', removed: true },
  minute: 40,
})

function mountDialog(event: GameEvent | null) {
  return mount(GameEventFormDialog, {
    props: { modelValue: true, gameId: 7, teams, event },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
}

function field(wrapper: VueWrapper, test: string) {
  const found = wrapper
    .findAllComponents({ name: 'VAutocomplete' })
    .find((c) => c.attributes('data-test') === test)
  if (!found) throw new Error(`VAutocomplete[data-test=${test}] não encontrado`)
  return found
}

function itemIds(wrapper: VueWrapper, test: string) {
  return (field(wrapper, test).props('items') as { id: number }[]).map((p) => p.id)
}

describe('GameEventFormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
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

    // O autor removido não vira opção de assistência e vice-versa.
    expect(itemIds(wrapper, 'event-player')).toEqual([11, 12, 99])
    expect(itemIds(wrapper, 'event-assist')).toEqual([11, 12, 98])

    // Em outro time o removido não faz sentido (ele pertence ao time do evento).
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
})
