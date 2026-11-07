import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameFormDialog from '@/components/games/GameFormDialog.vue'
import { gamesService } from '@/services/api/games.service'
import { createTestVuetify } from '@/test/utils'
import { apiError, makeGame, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: { create: vi.fn(), update: vi.fn() },
}))

const teams = [makeTeam(1, 'Flamengo'), makeTeam(2, 'Bahia')]

async function mountDialog(game: ReturnType<typeof makeGame> | null = null) {
  const wrapper = mount(GameFormDialog, {
    props: { modelValue: true, leagueId: 7, format: 'round_robin', teams, stadiums: [], game },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function has(test: string) {
  return document.querySelector(`[data-test="${test}"]`) !== null
}

async function choose(wrapper: VueWrapper, name: string, test: string, value: unknown) {
  const field = wrapper
    .findAllComponents({ name })
    .find((component) => component.attributes('data-test') === test)
  field!.vm.$emit('update:modelValue', value)
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('GameFormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('nova partida não mostra status nem gols e nasce agendada, sem enviar placar', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    const wrapper = await mountDialog()

    expect(has('game-status')).toBe(false)
    expect(has('game-home-score')).toBe(false)
    expect(has('game-away-score')).toBe(false)
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await submit()

    const payload = vi.mocked(gamesService.create).mock.calls[0][0]
    expect(payload).toMatchObject({ status: 'scheduled', home_team_id: 1, away_team_id: 2 })
    expect(payload).not.toHaveProperty('home_score')
    expect(payload).not.toHaveProperty('away_score')
  })

  it('edição mostra status, sem campos de gols, e não envia o placar (calculado pela súmula)', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(makeGame(3))
    const wrapper = await mountDialog(
      makeGame(3, { league_id: 7, round: 1, status: 'in_progress', home_score: 1, away_score: 0 }),
    )

    expect(has('game-status')).toBe(true)
    expect(has('game-home-score')).toBe(false)
    expect(has('game-away-score')).toBe(false)
    await choose(wrapper, 'VSelect', 'game-status', 'finished')
    await submit()

    const [id, payload] = vi.mocked(gamesService.update).mock.calls[0]
    expect(id).toBe(3)
    expect(payload).toMatchObject({ status: 'finished', round: 1 })
    expect(payload).not.toHaveProperty('home_score')
    expect(payload).not.toHaveProperty('away_score')
  })

  function fieldOrder() {
    return [...document.querySelectorAll('.v-dialog [data-test^="game-"]')].map((el) =>
      el.getAttribute('data-test'),
    )
  }

  function colWidths(test: string) {
    const col = document.querySelector(`[data-test="${test}"]`)!.parentElement!
    return [...col.classList].filter((name) => /^v-col-(sm-)?\d+$/.test(name)).sort()
  }

  it('disposição: times em linhas próprias, status + data, rodada + estádio', async () => {
    await mountDialog(makeGame(3, { league_id: 7, round: 1 }))

    expect(fieldOrder()).toEqual([
      'game-home-team',
      'game-away-team',
      'game-status',
      'game-match-date',
      'game-round',
      'game-stadium',
    ])
    expect(colWidths('game-home-team')).toEqual(['v-col-12'])
    expect(colWidths('game-away-team')).toEqual(['v-col-12'])
    for (const test of ['game-status', 'game-match-date', 'game-round', 'game-stadium']) {
      expect(colWidths(test)).toEqual(['v-col-12', 'v-col-sm-6'])
    }
  })

  it('na criação, sem status, a data ocupa a linha inteira', async () => {
    await mountDialog()

    expect(fieldOrder()).toEqual([
      'game-home-team',
      'game-away-team',
      'game-match-date',
      'game-round',
      'game-stadium',
    ])
    expect(colWidths('game-match-date')).toEqual(['v-col-12', 'v-col-sm-12'])
  })

  it('mata-mata: a fase fica no lugar da rodada e ordem, confronto e perna logo abaixo', async () => {
    document.body.innerHTML = ''
    mount(GameFormDialog, {
      props: { modelValue: true, leagueId: 7, format: 'knockout', teams, stadiums: [], game: null },
      global: { plugins: [createTestVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    expect(fieldOrder()).toEqual([
      'game-home-team',
      'game-away-team',
      'game-match-date',
      'game-phase',
      'game-stadium',
      'game-phase-order',
      'game-tie-key',
      'game-leg',
    ])
  })
})

describe('GameFormDialog — ligas com sorteio', () => {
  const fourTeams = [...teams, makeTeam(3, 'Ceará'), makeTeam(4, 'Grêmio')]

  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  async function mountDraw(props: Record<string, unknown>) {
    const wrapper = mount(GameFormDialog, {
      props: {
        modelValue: true,
        leagueId: 7,
        format: 'hybrid',
        fixtureMode: 'draw',
        teams: fourTeams,
        stadiums: [],
        ...props,
      },
      global: { plugins: [createTestVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  function component(wrapper: VueWrapper, name: string, test: string) {
    return wrapper.findAllComponents({ name }).find((c) => c.attributes('data-test') === test)!
  }

  const drawnGame = (round: number) =>
    makeGame(5, { league_id: 7, round, group_number: 2, home_team_id: 1, away_team_id: 2 })

  it('nova partida: Rodada e Fase indisponíveis com dica e nada é enviado', async () => {
    const wrapper = await mountDraw({ game: null })

    const button = (value: string) =>
      document.querySelector(
        `[data-test="game-stage-toggle"] button[value="${value}"]`,
      ) as HTMLButtonElement
    expect(button('round').disabled).toBe(true)
    expect(button('phase').disabled).toBe(true)
    expect(document.querySelector('[data-test="game-stage-unavailable"]')?.textContent).toContain(
      'Em ligas com sorteio, as partidas de rodada são criadas na tela Sorteio e as de mata-mata são geradas pela classificação.',
    )
    expect(component(wrapper, 'VCombobox', 'game-phase').props('disabled')).toBe(true)

    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await submit()
    expect(gamesService.create).not.toHaveBeenCalled()
  })

  it('liga manual continua com Rodada disponível', async () => {
    await mountDraw({ game: null, fixtureMode: 'manual' })
    const roundButton = document.querySelector(
      '[data-test="game-stage-toggle"] button[value="round"]',
    ) as HTMLButtonElement
    expect(roundButton.disabled).toBe(false)
    expect(has('game-round')).toBe(true)
    expect(has('game-stage-unavailable')).toBe(false)
  })

  it('jogo sorteado no turno: rodada e etapa travadas, aviso, times livres e Inverter mando', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(drawnGame(2))
    const wrapper = await mountDraw({ game: drawnGame(2), roundsPerTurn: 3, groupsCount: 2 })

    expect(document.querySelector('[data-test="game-drawn-notice"]')?.textContent).toContain(
      'Partida sorteada (Grupo B · 2ª rodada).',
    )
    expect(component(wrapper, 'VTextField', 'game-round').props('disabled')).toBe(true)
    expect(component(wrapper, 'VBtnToggle', 'game-stage-toggle').props('disabled')).toBe(true)
    expect(component(wrapper, 'VAutocomplete', 'game-home-team').props('disabled')).toBeFalsy()
    expect(component(wrapper, 'VAutocomplete', 'game-away-team').props('disabled')).toBeFalsy()

    document.querySelector<HTMLButtonElement>('[data-test="game-swap-teams"]')!.click()
    await flushPromises()
    await submit()

    expect(gamesService.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        home_team_id: 2,
        away_team_id: 1,
        round: 2,
        phase: null,
        tie_key: null,
        leg: null,
      }),
    )
    expect(vi.mocked(gamesService.update).mock.calls[0][1]).not.toHaveProperty('group_number')
  })

  it('jogo sorteado no returno: times desabilitados com dica, mas inverter o mando funciona', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(drawnGame(5))
    const wrapper = await mountDraw({ game: drawnGame(5), roundsPerTurn: 3, groupsCount: 1 })

    expect(document.querySelector('[data-test="game-drawn-notice"]')?.textContent).toContain(
      'Partida sorteada (5ª rodada).',
    )
    expect(component(wrapper, 'VAutocomplete', 'game-home-team').props('disabled')).toBe(true)
    expect(component(wrapper, 'VAutocomplete', 'game-away-team').props('disabled')).toBe(true)
    expect(document.querySelector('[data-test="game-away-team"]')?.textContent).toContain(
      'No returno os confrontos seguem o turno; só é possível inverter o mando.',
    )

    document.querySelector<HTMLButtonElement>('[data-test="game-swap-teams"]')!.click()
    await flushPromises()
    await submit()
    expect(gamesService.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ home_team_id: 2, away_team_id: 1, round: 5 }),
    )
  })

  it('troca de times recusada pelo back mostra o 422 no diálogo', async () => {
    vi.mocked(gamesService.update).mockRejectedValue(
      apiError(422, 'O time Ceará já joga na rodada 2.'),
    )
    const wrapper = await mountDraw({ game: drawnGame(2), roundsPerTurn: 3 })

    await choose(wrapper, 'VAutocomplete', 'game-away-team', 3)
    await submit()

    expect(document.querySelector('[data-test="form-error"]')?.textContent).toContain(
      'O time Ceará já joga na rodada 2.',
    )
  })

  function roundButton() {
    return document.querySelector(
      '[data-test="game-stage-toggle"] button[value="round"]',
    ) as HTMLButtonElement
  }

  function phaseButton() {
    return document.querySelector(
      '[data-test="game-stage-toggle"] button[value="phase"]',
    ) as HTMLButtonElement
  }

  it('editar partida manual de rodada: Rodada ativa e o número da rodada pode mudar', async () => {
    const manual = makeGame(8, { league_id: 7, round: 3, group_number: null, phase: null })
    vi.mocked(gamesService.update).mockResolvedValue(manual)
    const wrapper = await mountDraw({ game: manual })

    expect(roundButton().disabled).toBe(false)
    expect(phaseButton().disabled).toBe(true)
    expect(document.querySelector('[data-test="game-stage-unavailable"]')?.textContent).toContain(
      'Em ligas com sorteio, as partidas de mata-mata são geradas pela classificação.',
    )
    expect(has('game-drawn-notice')).toBe(false)
    expect(component(wrapper, 'VTextField', 'game-round').props('disabled')).toBe(false)
    expect(component(wrapper, 'VBtnToggle', 'game-stage-toggle').props('disabled')).toBe(false)

    await choose(wrapper, 'VTextField', 'game-round', '4')
    await submit()
    expect(gamesService.update).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ round: 4, phase: null }),
    )
  })

  it('editar partida de fase manual numa liga com sorteio: Rodada desativada e a Fase continua editável', async () => {
    const manual = makeGame(6, {
      league_id: 7,
      round: null,
      phase: 'Final',
      phase_order: 4,
      tie_key: 'F1',
      leg: null,
    })
    vi.mocked(gamesService.update).mockResolvedValue(manual)
    const wrapper = await mountDraw({ game: manual })

    expect(roundButton().disabled).toBe(true)
    expect(phaseButton().disabled).toBe(false)
    expect(document.querySelector('[data-test="game-stage-unavailable"]')?.textContent).toContain(
      'Em ligas com sorteio, as partidas de rodada são criadas na tela Sorteio.',
    )
    expect(has('game-round')).toBe(false)
    expect(has('game-knockout-notice')).toBe(false)
    expect(component(wrapper, 'VCombobox', 'game-phase').props('disabled')).toBe(false)
    expect(component(wrapper, 'VTextField', 'game-tie-key').props('disabled')).toBe(false)
    expect(component(wrapper, 'VAutocomplete', 'game-home-team').props('disabled')).toBeFalsy()

    await choose(wrapper, 'VTextField', 'game-tie-key', 'F2')
    await submit()
    expect(gamesService.update).toHaveBeenCalledWith(
      6,
      expect.objectContaining({ phase: 'Final', tie_key: 'F2', round: null }),
    )
  })

  const generatedGame = makeGame(40, {
    league_id: 7,
    round: null,
    group_number: null,
    phase: 'Quartas de final',
    phase_order: 2,
    tie_key: 'QF-1',
    leg: 2,
    knockout_stage: 'QF',
    home_team_id: 1,
    away_team_id: 2,
  })

  it('jogo gerado pelo mata-mata: times, etapa, fase, ordem, confronto e perna travados, com aviso', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(generatedGame)
    const wrapper = await mountDraw({ game: generatedGame })

    expect(document.querySelector('[data-test="game-knockout-notice"]')?.textContent).toContain(
      'Partida gerada pelo mata-mata (Quartas de final · Volta · QF-1).',
    )
    expect(has('game-stage-unavailable')).toBe(false)
    expect(has('game-swap-teams')).toBe(false)
    expect(component(wrapper, 'VAutocomplete', 'game-home-team').props('disabled')).toBe(true)
    expect(component(wrapper, 'VAutocomplete', 'game-away-team').props('disabled')).toBe(true)
    expect(component(wrapper, 'VBtnToggle', 'game-stage-toggle').props('disabled')).toBe(true)
    expect(component(wrapper, 'VCombobox', 'game-phase').props('disabled')).toBe(true)
    expect(component(wrapper, 'VTextField', 'game-phase-order').props('disabled')).toBe(true)
    expect(component(wrapper, 'VTextField', 'game-tie-key').props('disabled')).toBe(true)
    expect(component(wrapper, 'VSelect', 'game-leg').props('disabled')).toBe(true)
    expect(component(wrapper, 'VSelect', 'game-status').props('disabled')).toBeFalsy()
    expect(component(wrapper, 'VTextField', 'game-match-date').props('disabled')).toBeFalsy()

    await choose(wrapper, 'VSelect', 'game-status', 'finished')
    await submit()
    expect(gamesService.update).toHaveBeenCalledWith(40, {
      league_id: 7,
      home_team_id: 1,
      away_team_id: 2,
      stadium_id: null,
      match_date: null,
      status: 'finished',
      round: null,
      phase: 'Quartas de final',
      phase_order: 2,
      tie_key: 'QF-1',
      leg: 2,
    })
  })

  it('jogo de grupo com mata-mata gerado: status, times e rodada travados e aviso no lugar do sorteado', async () => {
    const locked = makeGame(5, {
      league_id: 7,
      round: 2,
      group_number: 2,
      home_team_id: 1,
      away_team_id: 2,
      status: 'finished',
      results_locked: true,
    })
    vi.mocked(gamesService.update).mockResolvedValue(locked)
    const wrapper = await mountDraw({ game: locked, roundsPerTurn: 3, groupsCount: 2 })

    expect(document.querySelector('[data-test="game-locked-notice"]')?.textContent?.trim()).toBe(
      'Mata-mata já gerado: o resultado desta partida está travado. Dá para mudar só data e estádio; para corrigir o resultado, desfaça o mata-mata.',
    )
    expect(has('game-drawn-notice')).toBe(false)
    expect(has('game-swap-teams')).toBe(false)
    expect(component(wrapper, 'VSelect', 'game-status').props('disabled')).toBe(true)
    expect(component(wrapper, 'VAutocomplete', 'game-home-team').props('disabled')).toBe(true)
    expect(component(wrapper, 'VAutocomplete', 'game-away-team').props('disabled')).toBe(true)
    expect(component(wrapper, 'VTextField', 'game-round').props('disabled')).toBe(true)
    expect(component(wrapper, 'VTextField', 'game-match-date').props('disabled')).toBeFalsy()
    expect(component(wrapper, 'VAutocomplete', 'game-stadium').props('disabled')).toBeFalsy()

    await choose(wrapper, 'VTextField', 'game-match-date', '2026-05-10T15:00')
    await submit()
    expect(gamesService.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        status: 'finished',
        home_team_id: 1,
        away_team_id: 2,
        round: 2,
        match_date: '2026-05-10T15:00',
      }),
    )
  })

  it('returno travado não mostra a dica de inverter o mando', async () => {
    await mountDraw({
      game: makeGame(5, { league_id: 7, round: 5, group_number: 1, results_locked: true }),
      roundsPerTurn: 3,
    })
    expect(document.querySelector('[data-test="game-away-team"]')?.textContent).not.toContain(
      'só é possível inverter o mando',
    )
    expect(has('game-swap-teams')).toBe(false)
  })

  it('partida manual de rodada travada também bloqueia rodada e etapa', async () => {
    const wrapper = await mountDraw({
      game: makeGame(8, { league_id: 7, round: 3, group_number: null, results_locked: true }),
    })
    expect(has('game-locked-notice')).toBe(true)
    expect(component(wrapper, 'VTextField', 'game-round').props('disabled')).toBe(true)
    expect(component(wrapper, 'VBtnToggle', 'game-stage-toggle').props('disabled')).toBe(true)
  })

  it('jogo sorteado sem a trava continua com status e times livres', async () => {
    const wrapper = await mountDraw({
      game: makeGame(5, { league_id: 7, round: 2, group_number: 1, results_locked: false }),
      roundsPerTurn: 3,
    })
    expect(has('game-locked-notice')).toBe(false)
    expect(has('game-drawn-notice')).toBe(true)
    expect(has('game-swap-teams')).toBe(true)
    expect(component(wrapper, 'VSelect', 'game-status').props('disabled')).toBeFalsy()
    expect(component(wrapper, 'VAutocomplete', 'game-home-team').props('disabled')).toBeFalsy()
  })

  it('partida não sorteada não mostra aviso nem Inverter mando', async () => {
    await mountDraw({ game: makeGame(6, { league_id: 7, round: null, phase: 'Final' }) })
    expect(has('game-drawn-notice')).toBe(false)
    expect(has('game-swap-teams')).toBe(false)
  })
})
