import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameEventsPanel from '@/components/games/GameEventsPanel.vue'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { teamsService } from '@/services/api/teams.service'
import { useAuthStore } from '@/stores/auth'
import type { Game } from '@/types/game'
import { createTestVuetify, makeUser } from '@/test/utils'
import { makeEvent, makeGame, makePlayer, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/gameEvents.service', () => ({
  gameEventsService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: { get: vi.fn() },
}))

const ALL = ['game_event:create', 'game_event:update', 'game_event:delete']

const home = makeTeam(1, 'Esporte Clube Vitória', {
  nickname: 'Vitória',
  players: [makePlayer(11, 'Renato', { team_id: 1, number: 9 }), makePlayer(12, 'Matheuzinho', { team_id: 1 })],
})
const away = makeTeam(2, 'Esporte Clube Bahia', {
  nickname: 'Bahia',
  players: [makePlayer(21, 'Everaldo', { team_id: 2 })],
})

async function mountPanel(permissions: string[] = ALL, game: Game = makeGame(7)) {
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

describe('GameEventsPanel (Súmula)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(teamsService.get).mockImplementation(async (id) => (Number(id) === 1 ? home : away))
    vi.mocked(gameEventsService.list).mockResolvedValue([
      makeEvent(2, { game_id: 7, type: 'yellow_card', team_id: 2, player_id: 21, minute: 60 }),
      makeEvent(1, { game_id: 7, type: 'goal', team_id: 1, player_id: 11, related_player_id: 12, minute: 30 }),
    ])
  })

  it('carrega os eventos da partida (GET /game-events?game_id=) e os elencos dos dois times', async () => {
    const wrapper = await mountPanel()

    expect(gameEventsService.list).toHaveBeenCalledWith({ game_id: 7 })
    expect(teamsService.get).toHaveBeenCalledWith(1)
    expect(teamsService.get).toHaveBeenCalledWith(2)

    const rows = wrapper.findAll('[data-test="event-row"]').map((r) => r.text())
    expect(rows).toHaveLength(2)
    // Ordem cronológica pelo minuto.
    expect(rows[0]).toContain("30'")
    expect(rows[0]).toContain('Renato')
    expect(rows[0]).toContain('Gol · Vitória · Assistência: Matheuzinho')
    expect(rows[1]).toContain('Everaldo')
    expect(rows[1]).toContain('Cartão amarelo · Bahia')
  })

  it('jogador removido do elenco aparece pelo nome do evento com o selo "removido"', async () => {
    vi.mocked(gameEventsService.list).mockResolvedValue([
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
    ])
    const wrapper = await mountPanel()

    const [removed, active] = wrapper.findAll('[data-test="event-row"]')
    expect(removed.find('[data-test="event-player"] .text-truncate').text()).toBe('Zé Removido')
    expect(removed.find('[data-test="event-player"] [data-test="removed-badge"]').exists()).toBe(true)
    expect(removed.find('[data-test="event-subtitle"]').text()).toBe(
      'Gol · Vitória · Assistência: Assis Removido removido',
    )
    expect(removed.findAll('[data-test="removed-badge"]')).toHaveLength(2)
    expect(active.find('[data-test="event-player"]').text()).toBe('Renato')
    expect(active.find('[data-test="removed-badge"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Jogador fora do elenco')
  })

  it('sem a relação carregada, usa o elenco e por último o texto de fora do elenco', async () => {
    vi.mocked(gameEventsService.list).mockResolvedValue([
      makeEvent(1, { game_id: 7, team_id: 1, player_id: 11, related_player_id: 55, minute: 10 }),
    ])
    const wrapper = await mountPanel()

    const row = wrapper.find('[data-test="event-row"]')
    expect(row.find('[data-test="event-player"]').text()).toBe('Renato')
    expect(row.find('[data-test="event-subtitle"]').text()).toBe(
      'Gol · Vitória · Assistência: Jogador fora do elenco',
    )
    expect(row.find('[data-test="removed-badge"]').exists()).toBe(false)
  })

  it('times e jogadores do formulário ficam restritos aos dois times da partida', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="event-create"]').trigger('click')
    await flushPromises()

    expect(field(wrapper, 'VSelect', 'event-team').props('items')).toEqual([
      { id: 1, name: 'Vitória', players: home.players },
      { id: 2, name: 'Bahia', players: away.players },
    ])
    // Sem time escolhido o jogador fica desabilitado; ao escolher, só o elenco daquele time.
    expect(field(wrapper, 'VAutocomplete', 'event-player').props('disabled')).toBe(true)
    await choose(wrapper, 'VSelect', 'event-team', 2)
    const players = field(wrapper, 'VAutocomplete', 'event-player').props('items') as { id: number }[]
    expect(players.map((p) => p.id)).toEqual([21])
  })

  it('registra gol com assistência opcional vinculado a jogador e time', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, { ...payload, league_id: 1 }))
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="event-create"]').trigger('click')
    await flushPromises()

    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    // A assistência não oferece o próprio autor do gol.
    const assists = field(wrapper, 'VAutocomplete', 'event-assist').props('items') as { id: number }[]
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
    expect(wrapper.findAll('[data-test="event-row"]')).toHaveLength(3)
  })

  it('cartão não tem assistência e troca de tipo limpa a assistência escolhida', async () => {
    vi.mocked(gameEventsService.create).mockImplementation(async (payload) => makeEvent(9, payload))
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="event-create"]').trigger('click')
    await flushPromises()

    await choose(wrapper, 'VSelect', 'event-team', 1)
    await choose(wrapper, 'VAutocomplete', 'event-player', 11)
    await choose(wrapper, 'VAutocomplete', 'event-assist', 12)
    await choose(wrapper, 'VBtnToggle', 'event-type', 'red_card')
    expect(document.querySelector('[data-test="event-assist"]')).toBeNull()
    await submit()

    expect(gameEventsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'red_card', player_id: 11, related_player_id: null, minute: null }),
    )
  })

  it('não envia sem time e jogador', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="event-create"]').trigger('click')
    await flushPromises()
    await submit()

    expect(gameEventsService.create).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Selecione o time.')
    expect(document.body.textContent).toContain('Selecione o jogador.')
  })

  it('edita um evento com o formulário preenchido', async () => {
    vi.mocked(gameEventsService.update).mockImplementation(async (id, payload) => makeEvent(Number(id), payload))
    const wrapper = await mountPanel()
    await wrapper.findAll('[data-test="event-edit"]')[0].trigger('click')
    await flushPromises()

    expect(field(wrapper, 'VAutocomplete', 'event-player').props('modelValue')).toBe(11)
    await choose(wrapper, 'VTextField', 'event-minute', '31')
    await submit()

    expect(gameEventsService.update).toHaveBeenCalledWith(1, expect.objectContaining({ minute: 31, related_player_id: 12 }))
    expect(wrapper.find('[data-test="event-row"]').text()).toContain("31'")
  })

  it('exclui um evento após confirmar', async () => {
    vi.mocked(gameEventsService.remove).mockResolvedValue({} as never)
    const wrapper = await mountPanel()
    await wrapper.findAll('[data-test="event-delete"]')[0].trigger('click')
    await flushPromises()
    const confirm = [...document.querySelectorAll('.v-overlay--active button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(gameEventsService.remove).toHaveBeenCalledWith(1)
    expect(wrapper.findAll('[data-test="event-row"]')).toHaveLength(1)
  })

  it.each([
    ['sem permissões de súmula', [] as string[], [false, false, false]],
    ['só criar', ['game_event:create'], [true, false, false]],
    ['game_event:all', ['game_event:all'], [true, true, true]],
  ])('botões por permissão: %s', async (_label, permissions, [create, edit, del]) => {
    const wrapper = await mountPanel(permissions)
    expect(wrapper.find('[data-test="event-create"]').exists()).toBe(create)
    expect(wrapper.find('[data-test="event-edit"]').exists()).toBe(edit)
    expect(wrapper.find('[data-test="event-delete"]').exists()).toBe(del)
  })

  it('avisa quando os gols da súmula não batem com o placar finalizado', async () => {
    const wrapper = await mountPanel(ALL, makeGame(7, { status: 'finished', home_score: 2, away_score: 0 }))
    expect(wrapper.find('[data-test="score-mismatch"]').text()).toContain('(1 × 0)')
  })
})
