import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PenaltyShootoutEditor from '@/components/games/PenaltyShootoutEditor.vue'
import { filterPlayer } from '@/components/games/playerSearch'
import { SHOOTOUT_UNFINISHED, shootoutDecidedAt } from '@/components/games/shootout'
import { gamesService } from '@/services/api/games.service'
import { createTestVuetify } from '@/test/utils'
import { apiError, makeGame, makePlayer, makeTeam } from '@/test/factories'
import type { Game, GamePenaltyKick } from '@/types/game'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: { updatePenaltyKicks: vi.fn() },
}))

const homePlayers = [1, 2, 3, 4, 5].map((n) =>
  makePlayer(10 + n, `Mandante ${n}`, { team_id: 1, number: n }),
)
const awayPlayers = [1, 2, 3, 4, 5].map((n) =>
  makePlayer(20 + n, `Visitante ${n}`, { team_id: 2, number: n + 10 }),
)

function game(extra: Partial<Game> = {}): Game {
  return makeGame(4, {
    knockout_stage: 'F',
    round: null,
    phase: 'Final',
    home_score: 1,
    away_score: 1,
    status: 'finished',
    penalties_allowed: true,
    penaltyKicks: [],
    homeTeam: makeTeam(1, 'Atlético Serrano', { nickname: 'Serrano', players: homePlayers }),
    awayTeam: makeTeam(2, 'Clube Ribeirinho', { nickname: 'Ribeirinho', players: awayPlayers }),
    ...extra,
  })
}

function savedKick(order: number, team_id: number, player_id: number, scored: boolean) {
  const player = [...homePlayers, ...awayPlayers].find((p) => p.id === player_id)
  return {
    id: order,
    order,
    team_id,
    player_id,
    scored,
    player: {
      id: player_id,
      name: player?.name ?? `Removido ${player_id}`,
      number: player?.number ?? 99,
      removed: !player,
    },
  } satisfies GamePenaltyKick
}

function mountEditor(data: Game = game()) {
  return mount(PenaltyShootoutEditor, {
    props: { game: data },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
}

type Wrapper = VueWrapper<InstanceType<typeof PenaltyShootoutEditor>>

async function chooseFirst(wrapper: Wrapper, side: 'home' | 'away') {
  await wrapper.find(`[data-test="kick-first-${side}"] input`).setValue(true)
  await flushPromises()
}

function rows(wrapper: Wrapper) {
  return wrapper.findAll('[data-test="kick-row"]')
}

function playerField(wrapper: Wrapper, index: number) {
  return wrapper
    .findAllComponents({ name: 'VAutocomplete' })
    .find((field) => field.attributes('data-test') === `kick-player-${index}`)!
}

async function fillRow(wrapper: Wrapper, index: number, playerId: number, scored: boolean) {
  playerField(wrapper, index).vm.$emit('update:modelValue', playerId)
  await flushPromises()
  await rows(wrapper)
    [index].find(`[data-test="kick-${scored ? 'scored' : 'missed'}"]`)
    .trigger('click')
  await flushPromises()
}

async function fillSequence(wrapper: Wrapper, pattern: [number, boolean][]) {
  for (const [index, [player, scored]] of pattern.entries()) {
    await fillRow(wrapper, index, player, scored)
  }
}

const homeWinsAtSix: [number, boolean][] = [
  [11, true],
  [21, false],
  [12, true],
  [22, false],
  [13, true],
  [23, false],
]

function saveButton(wrapper: Wrapper) {
  return wrapper.find('[data-test="game-penalties-save"]')
}

describe('PenaltyShootoutEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('a lista começa ao escolher quem bateu primeiro e alterna os times', async () => {
    const wrapper = mountEditor()

    expect(rows(wrapper)).toHaveLength(0)
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()

    await chooseFirst(wrapper, 'away')
    expect(rows(wrapper).map((row) => row.find('[data-test="kick-team"]').text())).toEqual([
      'V · Ribeirinho',
    ])

    await fillRow(wrapper, 0, 21, true)
    await fillRow(wrapper, 1, 11, false)

    expect(rows(wrapper).map((row) => row.find('[data-test="kick-team"]').text())).toEqual([
      'V · Ribeirinho',
      'M · Serrano',
      'V · Ribeirinho',
    ])
    expect(wrapper.find('[data-test="shootout-result"]').text()).toBe('Placar parcial: 0 × 1')
    expect(wrapper.find('[data-test="kick-issue"]').text()).toBe(
      'Informe o cobrador e o resultado da cobrança 3.',
    )
  })

  it('o cobrador vem do elenco do time da cobrança e aceita busca pelo nº', async () => {
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')
    await fillRow(wrapper, 0, 11, true)

    expect(playerField(wrapper, 0).props('items')).toEqual(homePlayers)
    expect(playerField(wrapper, 1).props('items')).toEqual(awayPlayers)
    expect(playerField(wrapper, 1).props('customFilter')).toBe(filterPlayer)
    expect(playerField(wrapper, 1).props('autoSelectFirst')).toBe(true)
  })

  it('ao decidir a disputa bloqueia novas linhas e salva a lista inteira', async () => {
    const response = game({ home_penalties: 3, away_penalties: 0 })
    vi.mocked(gamesService.updatePenaltyKicks).mockResolvedValue(response)
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')

    await fillSequence(wrapper, homeWinsAtSix)

    expect(rows(wrapper)).toHaveLength(6)
    expect(wrapper.find('[data-test="kick-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="shootout-result"]').text()).toBe(
      'Disputa decidida: 3 × 0, Serrano vence',
    )
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()

    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(gamesService.updatePenaltyKicks).toHaveBeenCalledWith(
      4,
      homeWinsAtSix.map(([player_id, scored], index) => ({
        team_id: index % 2 ? 2 : 1,
        player_id,
        scored,
      })),
    )
    expect(wrapper.emitted('saved')).toEqual([[response]])
  })

  it('não salva com a disputa inacabada', async () => {
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')
    await fillSequence(wrapper, homeWinsAtSix.slice(0, 4))
    await rows(wrapper)[4].find('[data-test="kick-remove"]').trigger('click')
    await flushPromises()

    expect(rows(wrapper)).toHaveLength(4)
    expect(wrapper.find('[data-test="kick-issue"]').text()).toBe(SHOOTOUT_UNFINISHED)
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="kick-add"]').exists()).toBe(true)
  })

  it('cobranças depois da decisão: aviso e botão que remove as seguintes', async () => {
    const wrapper = mountEditor(
      game({
        penaltyKicks: [
          savedKick(1, 1, 11, true),
          savedKick(2, 2, 21, false),
          savedKick(3, 1, 12, true),
          savedKick(4, 2, 22, false),
          savedKick(5, 1, 13, true),
          savedKick(6, 2, 23, true),
          savedKick(7, 1, 14, true),
        ],
      }),
    )
    expect(rows(wrapper)).toHaveLength(7)

    await rows(wrapper)[5].find('[data-test="kick-missed"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="kick-after-decision"]').text()).toContain(shootoutDecidedAt(6))
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()

    await wrapper.find('[data-test="kick-trim"]').trigger('click')
    await flushPromises()

    expect(rows(wrapper)).toHaveLength(6)
    expect(wrapper.find('[data-test="kick-after-decision"]').exists()).toBe(false)
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('cobrador repetido antes de todos baterem é só um aviso', async () => {
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')

    await fillSequence(wrapper, [
      [11, true],
      [21, true],
      [11, true],
    ])

    const warning = rows(wrapper)[2].find('[data-test="kick-repeated"]')
    expect(warning.text()).toContain('já bateu na cobrança 1')
    expect(rows(wrapper)[0].find('[data-test="kick-repeated"]').exists()).toBe(false)
    expect(rows(wrapper)).toHaveLength(4)
  })

  it('carrega as cobranças gravadas, com cobrador removido marcado', async () => {
    const wrapper = mountEditor(
      game({
        penaltyKicks: [
          savedKick(1, 2, 99, true),
          savedKick(2, 1, 11, false),
          savedKick(3, 2, 21, true),
          savedKick(4, 1, 12, false),
          savedKick(5, 2, 22, true),
        ],
      }),
    )

    expect(rows(wrapper)).toHaveLength(5)
    expect(rows(wrapper)[0].find('[data-test="kick-team"]').text()).toBe('V · Ribeirinho')
    expect(playerField(wrapper, 0).props('items')).toContainEqual({
      id: 99,
      name: 'Removido 99',
      number: 99,
      removed: true,
    })
    expect(rows(wrapper)[0].find('[data-test="removed-badge"]').exists()).toBe(true)
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(
      wrapper.find('[data-test="shootout-row-away"] [data-test="shootout-first"]').exists(),
    ).toBe(true)
  })

  it('trocar quem bateu primeiro inverte os times e limpa os cobradores', async () => {
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')
    await fillRow(wrapper, 0, 11, true)

    await chooseFirst(wrapper, 'away')

    expect(rows(wrapper)[0].find('[data-test="kick-team"]').text()).toBe('V · Ribeirinho')
    expect(playerField(wrapper, 0).props('modelValue')).toBeNull()
  })

  it.each([
    [
      'erro do jogo inteiro em kicks',
      apiError(422, 'Erro', { kicks: ['A disputa de pênaltis ainda não está decidida.'] }),
      'A disputa de pênaltis ainda não está decidida.',
    ],
    [
      '422 só com message',
      apiError(422, 'O confronto não está empatado.'),
      'O confronto não está empatado.',
    ],
  ])('mostra o %s', async (_label, error, message) => {
    vi.mocked(gamesService.updatePenaltyKicks).mockRejectedValue(error)
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')
    await fillSequence(wrapper, homeWinsAtSix)

    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="game-penalties-error"]').text()).toBe(message)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('erros por cobrança aparecem na linha', async () => {
    vi.mocked(gamesService.updatePenaltyKicks).mockRejectedValue(
      apiError(422, 'Erro', {
        'kicks.2.player_id': ['O jogador informado foi removido do elenco.'],
        'kicks.3.team_id': ['O time informado não participa desta partida.'],
      }),
    )
    const wrapper = mountEditor()
    await chooseFirst(wrapper, 'home')
    await fillSequence(wrapper, homeWinsAtSix)

    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(playerField(wrapper, 2).props('errorMessages')).toEqual([
      'O jogador informado foi removido do elenco.',
    ])
    expect(rows(wrapper)[3].find('[data-test="kick-error"]').text()).toBe(
      'O time informado não participa desta partida.',
    )
    expect(wrapper.find('[data-test="game-penalties-error"]').text()).toBe(
      'Corrija as cobranças destacadas.',
    )
  })

  it('limpar pede confirmação na tela e envia a lista vazia', async () => {
    const response = game({ penaltyKicks: [] })
    vi.mocked(gamesService.updatePenaltyKicks).mockResolvedValue(response)
    const wrapper = mountEditor(game({ home_penalties: 4, away_penalties: 3 }))

    expect(wrapper.find('[data-test="game-penalties-legacy"]').text()).toContain('(4 × 3)')

    await wrapper.find('[data-test="game-penalties-clear"]').trigger('click')
    await wrapper.find('[data-test="game-penalties-clear-cancel"]').trigger('click')
    expect(wrapper.find('[data-test="game-penalties-confirm-clear"]').exists()).toBe(false)
    expect(gamesService.updatePenaltyKicks).not.toHaveBeenCalled()

    await wrapper.find('[data-test="game-penalties-clear"]').trigger('click')
    await wrapper.find('[data-test="game-penalties-clear-confirm"]').trigger('click')
    await flushPromises()

    expect(gamesService.updatePenaltyKicks).toHaveBeenCalledWith(4, [])
    expect(wrapper.emitted('saved')).toEqual([[response]])
  })

  it('sem permissão de digitar (confronto desempatado) só mostra a grade e o limpar', async () => {
    const wrapper = mountEditor(
      game({ penalties_allowed: false, penaltyKicks: [savedKick(1, 1, 11, true)] }),
    )

    expect(wrapper.find('[data-test="kick-first"]').exists()).toBe(false)
    expect(rows(wrapper)).toHaveLength(0)
    expect(saveButton(wrapper).exists()).toBe(false)
    expect(wrapper.findAll('[data-test="shootout-kick"]')).toHaveLength(10)
    expect(wrapper.find('[data-test="game-penalties-clear"]').exists()).toBe(true)
  })

  it('fase seguinte gerada: disputa travada, sem limpar', async () => {
    const wrapper = mountEditor(
      game({
        penalties_allowed: false,
        results_locked: true,
        results_lock: 'next_stage',
        penaltyKicks: [savedKick(1, 1, 11, true)],
      }),
    )

    expect(wrapper.find('[data-test="game-penalties-intro"]').text()).toBe(
      'Disputa travada: a fase seguinte do mata-mata já foi gerada. Para corrigir, desfaça a fase seguinte.',
    )
    expect(wrapper.find('[data-test="game-penalties-clear"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="kick-first"]').exists()).toBe(false)
    expect(saveButton(wrapper).exists()).toBe(false)
    expect(wrapper.findAll('[data-test="shootout-kick"]')).toHaveLength(10)
  })

  it('descartar alterações volta para as cobranças gravadas', async () => {
    const kicks = homeWinsAtSix.map(([player, scored], index) =>
      savedKick(index + 1, index % 2 ? 2 : 1, player, scored),
    )
    const wrapper = mountEditor(game({ penaltyKicks: kicks }))
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()

    await rows(wrapper)[5].find('[data-test="kick-scored"]').trigger('click')
    await flushPromises()
    expect(rows(wrapper)).toHaveLength(7)

    await wrapper.find('[data-test="game-penalties-discard"]').trigger('click')
    await flushPromises()

    expect(rows(wrapper)).toHaveLength(6)
    expect(wrapper.find('[data-test="game-penalties-discard"]').exists()).toBe(false)
  })
})
