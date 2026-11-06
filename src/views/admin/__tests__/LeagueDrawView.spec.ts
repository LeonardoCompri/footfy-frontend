import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LeagueDrawView from '@/views/admin/leagues/LeagueDrawView.vue'
import { gamesService } from '@/services/api/games.service'
import { leaguesService } from '@/services/api/leagues.service'
import { useSnackbar } from '@/composables/useSnackbar'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError, makeGame, makeTeam } from '@/test/factories'
import type { LeagueDrawState } from '@/types/leagueDraw'
import type { GroupTeam } from '@/types/leagueRules'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: {
    draw: vi.fn(),
    drawNextRound: vi.fn(),
    undoLastRound: vi.fn(),
    resetDraw: vi.fn(),
    groups: vi.fn(),
    saveGroups: vi.fn(),
  },
}))
vi.mock('@/services/api/games.service', () => ({ gamesService: { listAll: vi.fn() } }))

const NOTHING_DRAWN = 'Nenhuma rodada foi sorteada.'
const UNASSIGNED_TEAMS_REASON =
  'Todos os times da liga precisam estar em um grupo antes do sorteio.'

function drawState(extra: Partial<LeagueDrawState> = {}): LeagueDrawState {
  return {
    league_id: 7,
    format: 'hybrid',
    fixture_mode: 'draw',
    groups_count: 2,
    group_legs: 2,
    group_size: 3,
    rounds_per_turn: 3,
    total_rounds: 6,
    drawn_rounds: 0,
    next_round: 1,
    can_draw: true,
    draw_blocked_reason: null,
    can_undo: false,
    undo_blocked_reason: NOTHING_DRAWN,
    can_reset: false,
    reset_blocked_reason: NOTHING_DRAWN,
    manual_round_games: { total: 0, with_results: 0 },
    groups: [
      { group_number: 1, byes: [] },
      { group_number: 2, byes: [] },
    ],
    ...extra,
  }
}

const team = (id: number, name: string) =>
  makeTeam(id, name, { logo: id === 1 ? 'https://cdn/escudo.png' : null })
const groupTeam = (id: number): GroupTeam => ({
  id,
  name: `Time ${id}`,
  nickname: null,
  logo: null,
})

const ROUND_ONE = drawState({
  drawn_rounds: 1,
  next_round: 2,
  can_undo: true,
  undo_blocked_reason: null,
  can_reset: true,
  reset_blocked_reason: null,
  groups: [
    { group_number: 1, byes: [{ round: 1, team: groupTeam(3) }] },
    { group_number: 2, byes: [{ round: 1, team: groupTeam(6) }] },
  ],
})

const roundOneGames = [
  makeGame(11, {
    round: 1,
    group_number: 1,
    homeTeam: team(1, 'Atlético'),
    awayTeam: team(2, 'Bahia'),
    match_date: '2026-05-10 16:00:00',
  }),
  makeGame(12, {
    round: 1,
    group_number: 2,
    homeTeam: team(4, 'Ceará'),
    awayTeam: team(5, 'Grêmio'),
    status: 'finished',
    home_score: 2,
    away_score: 1,
  }),
  makeGame(13, { round: null, phase: 'Final', group_number: null }),
]

async function mountView(
  state: LeagueDrawState,
  permissions = ['game:read', 'tournament:update'],
  leagueExtra = {},
) {
  setupLeagueSession(makeUser('admin', permissions), [
    makeLeague(7, championshipA, { name: 'Série A', format: 'hybrid', ...leagueExtra }),
  ])
  vi.mocked(leaguesService.draw).mockResolvedValue(state)
  const router = createTestRouter()
  await router.push('/admin/liga/7/sorteio')
  const wrapper = mount(LeagueDrawView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function q(test: string) {
  return document.querySelector(`[data-test="${test}"]`)
}

function button(wrapper: VueWrapper, test: string) {
  return wrapper.find(`[data-test="${test}"]`)
}

function dialogText() {
  return document.querySelector('.v-dialog.v-overlay--active')?.textContent ?? ''
}

async function click(selector: string) {
  ;(document.querySelector(selector) as HTMLElement).click()
  await flushPromises()
}

describe('Sorteio de rodadas', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(gamesService.listAll).mockResolvedValue(roundOneGames)
  })

  it('mostra o progresso e as rodadas por grupo, com folga, data e link para o jogo', async () => {
    const wrapper = await mountView(ROUND_ONE)

    expect(button(wrapper, 'draw-progress-title').text()).toBe('Rodada 1 de 6 sorteada')
    expect(button(wrapper, 'draw-next-round').text()).toBe('Próxima: rodada 2 · Turno')
    expect(button(wrapper, 'draw-structure').text()).toBe('2 grupos de 3 times · Turno e returno')
    expect(gamesService.listAll).toHaveBeenCalledWith({ league_id: 7 })

    const rounds = wrapper.findAll('[data-test="draw-round"]')
    expect(rounds).toHaveLength(1)
    expect(rounds[0].text()).toContain('Rodada 1')
    expect(rounds[0].find('[data-test="draw-round-turn"]').text()).toBe('Turno')
    const groups = rounds[0].findAll('[data-test="draw-round-group"]')
    expect(groups.map((g) => g.find('.text-subtitle-2').text())).toEqual(['Grupo A', 'Grupo B'])
    expect(groups[0].find('[data-test="draw-game"]').text()).toContain('Atlético')
    expect(groups[0].find('[data-test="draw-game-date"]').text()).toBe('10/05/2026 16:00')
    expect(groups[0].find('[data-test="draw-bye"]').text()).toBe('Folga: Time 3')
    expect(groups[0].find('[data-test="draw-game"]').attributes('href')).toBe(
      '/admin/liga/7/partidas/11',
    )
    expect(groups[1].find('[data-test="draw-game-date"]').text()).toBe('Data a definir')
    expect(groups[1].text()).toContain('Finalizada')
    expect(groups[1].find('[data-test="draw-game-score"]').text()).toBe('2 × 1')
    expect(groups[0].find('[data-test="draw-game-score"]').exists()).toBe(false)
    expect(groups[1].find('[data-test="draw-bye"]').text()).toBe('Folga: Time 6')
    expect(wrapper.findAll('[data-test="draw-game"]')).toHaveLength(2)

    expect(button(wrapper, 'draw-next').text()).toBe('Sortear rodada 2')
    expect(button(wrapper, 'draw-undo').text()).toBe('Desfazer rodada 1')
    expect(button(wrapper, 'draw-reset').text()).toBe('Reiniciar sorteio')
  })

  it('quem só tem game:read vê o estado sem os botões', async () => {
    const wrapper = await mountView(ROUND_ONE, ['game:read'])

    expect(wrapper.findAll('[data-test="draw-round"]')).toHaveLength(1)
    expect(button(wrapper, 'draw-actions').exists()).toBe(false)
    expect(button(wrapper, 'draw-rules-link').exists()).toBe(false)
  })

  it('desabilita cada botão por can_* e mostra o motivo', async () => {
    const wrapper = await mountView(
      drawState({
        drawn_rounds: 6,
        next_round: null,
        can_draw: false,
        draw_blocked_reason: 'Todas as rodadas já foram sorteadas.',
        can_undo: false,
        undo_blocked_reason:
          'A rodada 6 não pode ser desfeita porque tem partidas que já começaram ou têm eventos.',
        can_reset: false,
        reset_blocked_reason:
          'O sorteio não pode ser reiniciado porque há partidas de grupo que já começaram ou têm eventos.',
      }),
    )

    expect(button(wrapper, 'draw-next').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'draw-undo').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'draw-reset').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'draw-blocked').text()).toContain('Todas as rodadas já foram sorteadas.')
    expect(button(wrapper, 'draw-complete').exists()).toBe(true)
    expect(button(wrapper, 'draw-undo-blocked').text()).toContain(
      'A rodada 6 não pode ser desfeita',
    )
    expect(button(wrapper, 'draw-reset-blocked').text()).toContain(
      'O sorteio não pode ser reiniciado',
    )
  })

  it('antes da 1ª rodada não mostra desfazer/reiniciar e não busca jogos', async () => {
    const wrapper = await mountView(drawState())

    expect(button(wrapper, 'draw-progress-title').text()).toBe('Nenhuma rodada sorteada')
    expect(button(wrapper, 'draw-next').attributes('disabled')).toBeUndefined()
    expect(button(wrapper, 'draw-undo').exists()).toBe(false)
    expect(button(wrapper, 'draw-reset').exists()).toBe(false)
    expect(button(wrapper, 'draw-empty').exists()).toBe(true)
    expect(gamesService.listAll).not.toHaveBeenCalled()
  })

  it('1ª rodada: avisa as limitações de edição e envia só { round: 1 }', async () => {
    vi.mocked(leaguesService.drawNextRound).mockResolvedValue(ROUND_ONE)
    const wrapper = await mountView(drawState())

    await button(wrapper, 'draw-next').trigger('click')
    await flushPromises()

    const items = [...document.querySelectorAll('[data-test="draw-confirm-limits"] li')].map((li) =>
      li.textContent?.trim(),
    )
    expect(items).toEqual([
      'Dá para mudar data, estádio e status e inverter o mando.',
      'Não dá para criar ou excluir partidas de rodada, nem mudar a rodada ou o grupo.',
      'A troca de times quase nunca é possível, e no returno os confrontos seguem o turno.',
      'Não dá para adicionar times à liga.',
      'A estrutura do Regulamento (grupos e turnos) fica travada.',
    ])
    expect(q('draw-confirm-manual')).toBeNull()
    expect(leaguesService.drawNextRound).not.toHaveBeenCalled()

    await click('[data-test="draw-confirm-submit"]')

    expect(leaguesService.drawNextRound).toHaveBeenCalledWith(7, { round: 1 })
    expect(leaguesService.saveGroups).not.toHaveBeenCalled()
    expect(gamesService.listAll).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-test="draw-round"]')).toHaveLength(1)
    expect(useSnackbar().message.value).toBe('Rodada 1 sorteada.')
  })

  it('com partidas manuais avisa a substituição e envia replace_manual_rounds', async () => {
    vi.mocked(leaguesService.drawNextRound).mockResolvedValue(ROUND_ONE)
    const wrapper = await mountView(
      drawState({ group_legs: 1, manual_round_games: { total: 4, with_results: 0 } }),
    )

    await button(wrapper, 'draw-next').trigger('click')
    await flushPromises()

    expect(q('draw-confirm-manual')?.textContent).toContain(
      'A liga tem 4 partidas de rodada cadastradas manualmente. Elas serão apagadas antes do sorteio.',
    )
    expect(q('draw-confirm-manual-results')).toBeNull()
    expect(dialogText()).toContain('A troca de times quase nunca é possível.')
    expect(dialogText()).not.toContain('returno')
    expect(q('draw-confirm-submit')?.textContent?.trim()).toBe('Apagar e sortear')

    await click('[data-test="draw-confirm-submit"]')
    expect(leaguesService.drawNextRound).toHaveBeenCalledWith(7, {
      round: 1,
      replace_manual_rounds: true,
    })
  })

  it('destaca quando partidas manuais têm resultado ou eventos', async () => {
    const wrapper = await mountView(
      drawState({ manual_round_games: { total: 1, with_results: 1 } }),
    )

    await button(wrapper, 'draw-next').trigger('click')
    await flushPromises()

    expect(q('draw-confirm-manual')?.textContent).toContain(
      '1 partida de rodada cadastrada manualmente',
    )
    expect(q('draw-confirm-manual-results')?.textContent).toContain(
      '1 delas tem resultado ou eventos, que também serão perdidos.',
    )
  })

  it('rodadas seguintes sorteiam direto com round = next_round, sem clique duplo', async () => {
    let resolve: (state: LeagueDrawState) => void = () => undefined
    vi.mocked(leaguesService.drawNextRound).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = await mountView(ROUND_ONE)

    await button(wrapper, 'draw-next').trigger('click')
    await button(wrapper, 'draw-next').trigger('click')
    await flushPromises()

    expect(q('draw-confirm-dialog')).toBeNull()
    expect(leaguesService.drawNextRound).toHaveBeenCalledTimes(1)
    expect(leaguesService.drawNextRound).toHaveBeenCalledWith(7, { round: 2 })
    expect(button(wrapper, 'draw-next').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'draw-undo').attributes('disabled')).toBeDefined()

    resolve(drawState({ ...ROUND_ONE, drawn_rounds: 2, next_round: 3 }))
    await flushPromises()
    expect(button(wrapper, 'draw-next').text()).toBe('Sortear rodada 3')
    expect(button(wrapper, 'draw-next').attributes('disabled')).toBeUndefined()
    expect(gamesService.listAll).toHaveBeenCalledTimes(2)
  })

  it('desfazer pede confirmação e envia round = drawn_rounds', async () => {
    vi.mocked(leaguesService.undoLastRound).mockResolvedValue(drawState())
    const wrapper = await mountView(ROUND_ONE)

    await button(wrapper, 'draw-undo').trigger('click')
    await flushPromises()
    expect(dialogText()).toContain('As partidas da rodada 1 serão apagadas em todos os grupos.')
    expect(leaguesService.undoLastRound).not.toHaveBeenCalled()

    const confirm = [...document.querySelectorAll('.v-dialog.v-overlay--active button')].find(
      (b) => b.textContent?.trim() === 'Desfazer',
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(leaguesService.undoLastRound).toHaveBeenCalledWith(7, 1)
    expect(wrapper.findAll('[data-test="draw-round"]')).toHaveLength(0)
    expect(useSnackbar().message.value).toBe('Rodada 1 desfeita.')
  })

  it('reiniciar exige digitar REINICIAR', async () => {
    vi.mocked(leaguesService.resetDraw).mockResolvedValue(drawState())
    const wrapper = await mountView(ROUND_ONE)

    await button(wrapper, 'draw-reset').trigger('click')
    await flushPromises()
    expect(dialogText()).toContain('A rodada sorteada será apagada')
    const confirm = q('draw-reset-confirm') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    const input = document.querySelector('[data-test="draw-reset-input"] input') as HTMLInputElement
    input.value = 'reiniciar'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(confirm.disabled).toBe(false)
    confirm.click()
    await flushPromises()

    expect(leaguesService.resetDraw).toHaveBeenCalledWith(7)
    expect(button(wrapper, 'draw-progress-title').text()).toBe('Nenhuma rodada sorteada')
  })

  it('pontos corridos com 1 grupo: usa o estado do back e sorteia sem mexer nos grupos', async () => {
    vi.mocked(leaguesService.drawNextRound).mockResolvedValue(ROUND_ONE)
    const wrapper = await mountView(
      drawState({
        format: 'round_robin',
        groups_count: 1,
        group_legs: 1,
        group_size: 4,
        rounds_per_turn: 3,
        total_rounds: 3,
        groups: [{ group_number: 1, byes: [] }],
      }),
      undefined,
      { format: 'round_robin' },
    )

    expect(leaguesService.groups).not.toHaveBeenCalled()
    expect(button(wrapper, 'draw-blocked').exists()).toBe(false)
    expect(button(wrapper, 'draw-structure').text()).toBe('4 times · Turno único')
    expect(button(wrapper, 'draw-next-round').text()).toBe('Próxima: rodada 1')
    expect(button(wrapper, 'draw-next').attributes('disabled')).toBeUndefined()

    await button(wrapper, 'draw-next').trigger('click')
    await flushPromises()
    expect(q('draw-confirm-limits')).not.toBeNull()
    expect(dialogText()).not.toContain('Grupo A')

    await click('[data-test="draw-confirm-submit"]')
    expect(leaguesService.saveGroups).not.toHaveBeenCalled()
    expect(leaguesService.drawNextRound).toHaveBeenCalledWith(7, { round: 1 })
  })

  it('o total de rodadas do progresso vem de total_rounds', async () => {
    const wrapper = await mountView(
      drawState({ ...ROUND_ONE, groups_count: 1, group_legs: 1, total_rounds: 3 }),
    )

    expect(button(wrapper, 'draw-progress-title').text()).toBe('Rodada 1 de 3 sorteada')
  })

  it('com 2+ grupos sem montagem válida aponta para o Regulamento', async () => {
    const wrapper = await mountView(
      drawState({
        group_size: null,
        rounds_per_turn: null,
        total_rounds: null,
        can_draw: false,
        draw_blocked_reason: UNASSIGNED_TEAMS_REASON,
      }),
    )

    expect(leaguesService.groups).not.toHaveBeenCalled()
    expect(button(wrapper, 'draw-blocked').text()).toContain(UNASSIGNED_TEAMS_REASON)
    expect(button(wrapper, 'draw-groups-link').attributes('href')).toBe('/admin/liga/7/regulamento')
    expect(button(wrapper, 'draw-next').attributes('disabled')).toBeDefined()
  })

  it('erro 422 aparece na tela e o estado é recarregado', async () => {
    vi.mocked(leaguesService.drawNextRound).mockRejectedValue(
      apiError(422, 'A rodada 2 já foi sorteada.'),
    )
    const wrapper = await mountView(ROUND_ONE)
    vi.mocked(leaguesService.draw).mockResolvedValue(
      drawState({ ...ROUND_ONE, drawn_rounds: 2, next_round: 3 }),
    )

    await button(wrapper, 'draw-next').trigger('click')
    await flushPromises()

    expect(button(wrapper, 'draw-error').text()).toContain('A rodada 2 já foi sorteada.')
    expect(leaguesService.draw).toHaveBeenCalledTimes(2)
    expect(button(wrapper, 'draw-next').text()).toBe('Sortear rodada 3')
  })

  it('liga sem sorteio mostra o aviso e nenhuma ação', async () => {
    const wrapper = await mountView(
      drawState({ fixture_mode: 'manual', can_draw: false, draw_blocked_reason: 'x' }),
    )

    expect(button(wrapper, 'draw-not-enabled').text()).toContain(
      'Esta liga não usa sorteio de rodadas',
    )
    expect(button(wrapper, 'draw-actions').exists()).toBe(false)
  })
})
