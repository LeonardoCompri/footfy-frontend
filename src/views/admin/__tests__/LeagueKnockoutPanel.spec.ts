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
import { apiError, makeKnockoutState } from '@/test/factories'
import type { LeagueDrawState } from '@/types/leagueDraw'
import type {
  KnockoutPreview,
  KnockoutPreviewTie,
  LeagueKnockoutState,
} from '@/types/leagueKnockout'
import type { KnockoutPhase } from '@/types/leagueStats'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: {
    draw: vi.fn(),
    table: vi.fn(),
    knockout: vi.fn(),
    knockoutPreview: vi.fn(),
    knockoutNextStage: vi.fn(),
    undoKnockoutStage: vi.fn(),
  },
}))
vi.mock('@/services/api/games.service', () => ({ gamesService: { listAll: vi.fn() } }))

const DRAW_DONE: LeagueDrawState = {
  league_id: 7,
  format: 'hybrid',
  fixture_mode: 'draw',
  groups_count: 2,
  group_legs: 1,
  group_size: 4,
  rounds_per_turn: 3,
  total_rounds: 3,
  drawn_rounds: 3,
  next_round: null,
  can_draw: false,
  draw_blocked_reason: 'Todas as rodadas já foram sorteadas.',
  can_undo: true,
  undo_blocked_reason: null,
  can_reset: true,
  reset_blocked_reason: null,
  manual_round_games: { total: 0, with_results: 0 },
  groups: [
    { group_number: 1, byes: [] },
    { group_number: 2, byes: [] },
  ],
}

const team = (id: number, name: string) => ({ id, name: `${name} FC`, nickname: name, logo: null })

function previewTie(
  key: string,
  homeLabel: string,
  awayLabel: string,
  legs = 2,
): KnockoutPreviewTie {
  return {
    tie_key: key,
    home_team: team(1, 'Vitória'),
    away_team: team(2, 'Bahia'),
    home_label: homeLabel,
    away_label: awayLabel,
    legs:
      legs === 2
        ? [
            { leg: 1, home_team_id: 2, away_team_id: 1 },
            { leg: 2, home_team_id: 1, away_team_id: 2 },
          ]
        : [{ leg: null, home_team_id: 1, away_team_id: 2 }],
  }
}

const QF_PREVIEW: KnockoutPreview = {
  stage: { key: 'QF', label: 'Quartas de final', legs: 2 },
  ties: [
    previewTie('QF-1', '1º Grupo A', '4º Grupo B'),
    previewTie('QF-2', '2º Grupo B', '3º Grupo A'),
  ],
  third_place: null,
}

const QF_GENERATED = makeKnockoutState({
  stages: [
    { key: 'QF', label: 'Quartas de final', legs: 2, generated: true },
    { key: 'SF', label: 'Semifinal', legs: 2, generated: false },
    { key: '3P', label: 'Disputa de 3º lugar', legs: 1, generated: false },
    { key: 'F', label: 'Final', legs: 1, generated: false },
  ],
  generated_stages: ['QF'],
  last_stage: 'QF',
  next_stage: { key: 'SF', label: 'Semifinal', legs: 2, with_third_place: false },
  can_generate: false,
  generate_blocked_reason: 'Há confrontos das quartas de final ainda não decididos.',
  can_undo: true,
  undo_blocked_reason: null,
  awaiting_penalties: [{ stage: 'QF', tie_key: 'QF-2', game_id: 45 }],
})

const QF_PHASE: KnockoutPhase = {
  phase: 'Quartas de final',
  phase_order: 2,
  stage: 'QF',
  ties: [
    {
      tie_key: 'QF-1',
      decided: true,
      winner_team_id: 1,
      decided_by: 'aggregate',
      awaiting_penalties: false,
      decisive_game_id: 41,
      home_penalties: null,
      away_penalties: null,
      teams: [
        { team_id: 2, name: 'Bahia FC', nickname: 'Bahia', aggregate_score: 1 },
        { team_id: 1, name: 'Vitória FC', nickname: 'Vitória', aggregate_score: 3 },
      ],
      legs: [
        {
          id: 40,
          leg: 1,
          home_team_id: 2,
          away_team_id: 1,
          home_score: 1,
          away_score: 1,
          status: 'finished',
          match_date: null,
        },
        {
          id: 41,
          leg: 2,
          home_team_id: 1,
          away_team_id: 2,
          home_score: 2,
          away_score: 0,
          status: 'finished',
          match_date: null,
        },
      ],
    },
  ],
}

async function mountPanel(
  state: LeagueKnockoutState,
  {
    permissions = ['game:read', 'tournament:update'],
    phases = [] as KnockoutPhase[],
    draw = DRAW_DONE,
  } = {},
) {
  setupLeagueSession(makeUser('admin', permissions), [
    makeLeague(7, championshipA, {
      name: 'Série A',
      format: 'hybrid',
      fixture_mode: 'draw',
      groups_count: 2,
      qualifiers_per_group: 4,
      knockout_size: 8,
      third_place: true,
    }),
  ])
  vi.mocked(leaguesService.draw).mockResolvedValue(draw)
  vi.mocked(leaguesService.knockout).mockResolvedValue(state)
  vi.mocked(leaguesService.table).mockResolvedValue({ phases })
  const router = createTestRouter()
  await router.push('/admin/liga/7/sorteio?tab=mata-mata')
  const wrapper = mount(LeagueDrawView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

function find(wrapper: VueWrapper, test: string) {
  return wrapper.find(`[data-test="${test}"]`)
}

function activeDialog() {
  return document.querySelector('.v-dialog.v-overlay--active')
}

async function click(selector: string) {
  ;(document.querySelector(selector) as HTMLElement).click()
  await flushPromises()
}

describe('Mata-mata na tela do Sorteio', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(gamesService.listAll).mockResolvedValue([])
    vi.mocked(leaguesService.knockoutPreview).mockResolvedValue(QF_PREVIEW)
  })

  it('aba Mata-mata só em liga híbrida com sorteio e carrega o estado e a chave sob demanda', async () => {
    const { wrapper, router } = await mountPanel(makeKnockoutState())

    expect(find(wrapper, 'draw-tabs').exists()).toBe(true)
    expect(leaguesService.knockout).toHaveBeenCalledWith(7)
    expect(leaguesService.table).toHaveBeenCalledWith(7)
    expect(find(wrapper, 'draw-progress').exists()).toBe(false)

    await router.replace({ query: { tab: 'grupos' } })
    await flushPromises()
    expect(find(wrapper, 'draw-progress').exists()).toBe(true)
    expect(find(wrapper, 'knockout-progress').exists()).toBe(false)
  })

  it('pontos corridos com sorteio não tem a aba Mata-mata', async () => {
    const { wrapper } = await mountPanel(makeKnockoutState(), {
      draw: { ...DRAW_DONE, format: 'round_robin' },
    })

    expect(find(wrapper, 'draw-tabs').exists()).toBe(false)
    expect(find(wrapper, 'draw-progress').exists()).toBe(true)
    expect(leaguesService.knockout).not.toHaveBeenCalled()
  })

  it('estado: fases gerada/pendente, próximo passo, bloqueio e pênaltis pendentes com link', async () => {
    const { wrapper } = await mountPanel(QF_GENERATED, { phases: [QF_PHASE] })

    const stages = wrapper.findAll('[data-test="knockout-stage"]')
    expect(stages.map((s) => [s.text(), s.attributes('data-generated')])).toEqual([
      ['Quartas de final (gerada)', 'true'],
      ['Semifinal (pendente)', 'false'],
      ['Disputa de 3º lugar (pendente)', 'false'],
      ['Final (pendente)', 'false'],
    ])
    expect(find(wrapper, 'knockout-next').text()).toBe('Próxima: Semifinal · Ida e volta')
    expect(find(wrapper, 'knockout-blocked').text()).toBe(
      'Há confrontos das quartas de final ainda não decididos.',
    )
    expect(find(wrapper, 'knockout-generate').attributes('disabled')).toBeDefined()
    expect(find(wrapper, 'knockout-generate').text()).toBe('Gerar semifinal')
    expect(find(wrapper, 'knockout-undo').attributes('disabled')).toBeUndefined()
    expect(find(wrapper, 'knockout-undo').text()).toBe('Desfazer quartas de final')
    const link = find(wrapper, 'knockout-awaiting-link')
    expect(link.text()).toBe('QF-2: lançar pênaltis')
    expect(link.attributes('href')).toBe('/admin/liga/7/partidas/45?tab=sumula')
  })

  it('chave: confronto gerado com link para cada jogo e as fases futuras projetadas', async () => {
    const { wrapper } = await mountPanel(QF_GENERATED, { phases: [QF_PHASE] })

    const titles = wrapper.findAll('[data-test="knockout-phase-title"]').map((t) => t.text())
    expect(titles).toEqual(['Quartas de final', 'Semifinal', 'Disputa de 3º lugar', 'Final'])
    const legs = wrapper.findAll('[data-test="knockout-leg"]')
    expect(legs.map((leg) => leg.attributes('href'))).toEqual([
      '/admin/liga/7/partidas/40',
      '/admin/liga/7/partidas/41',
    ])
    expect(find(wrapper, 'knockout-tie-outcome').text()).toBe('Classificado: Vitória')
    const future = wrapper.findAll('[data-test="knockout-future-tie"]').map((t) => t.text())
    expect(future[0]).toContain('SF-1')
    expect(future[0]).toContain('Vitória')
    expect(future[0]).toContain('Vencedor QF-2')
    expect(future[2]).toContain('Perdedor SF-1')
    expect(future[2]).toContain('Perdedor SF-2')
  })

  it('gerar abre o preview, mostra os confrontos e envia stage = next_stage.key', async () => {
    const generated = { ...QF_GENERATED, awaiting_penalties: [] }
    vi.mocked(leaguesService.knockoutNextStage).mockResolvedValue(generated)
    const { wrapper } = await mountPanel(makeKnockoutState())
    vi.mocked(leaguesService.table).mockResolvedValue({ phases: [QF_PHASE] })
    vi.mocked(leaguesService.draw).mockClear()

    await find(wrapper, 'knockout-generate').trigger('click')
    await flushPromises()

    expect(leaguesService.knockoutPreview).toHaveBeenCalledWith(7)
    const dialog = activeDialog()!
    expect(dialog.textContent).toContain('Gerar quartas de final')
    const ties = [...dialog.querySelectorAll('[data-test="knockout-dialog-tie"]')]
    expect(ties).toHaveLength(2)
    expect(ties[0].querySelector('[data-test="knockout-dialog-labels"]')?.textContent?.trim()).toBe(
      '1º Grupo A × 4º Grupo B',
    )
    expect(
      [...ties[0].querySelectorAll('[data-test="knockout-dialog-leg"]')].map((leg) =>
        leg.textContent?.trim(),
      ),
    ).toEqual(['Ida: Bahia × Vitória', 'Volta: Vitória × Bahia'])
    expect(dialog.querySelector('[data-test="knockout-dialog-manual"]')).toBeNull()

    await click('.v-dialog.v-overlay--active [data-test="knockout-dialog-confirm"]')

    expect(leaguesService.knockoutNextStage).toHaveBeenCalledTimes(1)
    expect(leaguesService.knockoutNextStage).toHaveBeenCalledWith(7, { stage: 'QF' })
    expect(useSnackbar().message.value).toBe('Quartas de final: confrontos gerados.')
    expect(leaguesService.table).toHaveBeenCalledTimes(2)
    expect(leaguesService.draw).toHaveBeenCalledTimes(1)
    expect(find(wrapper, 'knockout-undo').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="knockout-tie"]')).toHaveLength(1)
  })

  it('final com 3º lugar: o preview mostra a disputa de 3º lugar junto', async () => {
    vi.mocked(leaguesService.knockoutPreview).mockResolvedValue({
      stage: { key: 'F', label: 'Final', legs: 1 },
      ties: [previewTie('F-1', 'Vencedor SF-1', 'Vencedor SF-2', 1)],
      third_place: previewTie('3P-1', 'Perdedor SF-1', 'Perdedor SF-2', 1),
    })
    const { wrapper } = await mountPanel(
      makeKnockoutState({
        last_stage: 'SF',
        generated_stages: ['QF', 'SF'],
        next_stage: { key: 'F', label: 'Final', legs: 1, with_third_place: true },
      }),
    )

    expect(find(wrapper, 'knockout-generate').text()).toBe('Gerar final e 3º lugar')
    await find(wrapper, 'knockout-generate').trigger('click')
    await flushPromises()

    const sections = [...activeDialog()!.querySelectorAll('[data-test="knockout-dialog-section"]')]
    expect(sections.map((s) => s.querySelector('h3')?.textContent)).toEqual([
      'Final',
      'Disputa de 3º lugar',
    ])
    expect(sections[1].textContent).toContain('Perdedor SF-1 × Perdedor SF-2')
    expect(sections[1].textContent).toContain('Jogo único: Vitória × Bahia')

    await click('.v-dialog.v-overlay--active [data-test="knockout-dialog-confirm"]')
    expect(leaguesService.knockoutNextStage).toHaveBeenCalledWith(7, { stage: 'F' })
  })

  it('preview com 422 mostra o motivo e não deixa confirmar', async () => {
    vi.mocked(leaguesService.knockoutPreview).mockRejectedValue(
      apiError(422, 'O grupo B não tem 4 times para classificar ao mata-mata.'),
    )
    const { wrapper } = await mountPanel(makeKnockoutState())

    await find(wrapper, 'knockout-generate').trigger('click')
    await flushPromises()

    const dialog = activeDialog()!
    expect(dialog.querySelector('[data-test="knockout-dialog-error"]')?.textContent).toContain(
      'O grupo B não tem 4 times para classificar ao mata-mata.',
    )
    const confirm = dialog.querySelector(
      '[data-test="knockout-dialog-confirm"]',
    ) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    confirm.click()
    await flushPromises()
    expect(leaguesService.knockoutNextStage).not.toHaveBeenCalled()
  })

  it.each([
    [{ total: 2, with_results: 0 }, false],
    [{ total: 3, with_results: 1 }, true],
  ])(
    'partidas de fase manuais %j: avisa, vira "Apagar e gerar" e envia replace_manual_phases',
    async (manual, highlighted) => {
      vi.mocked(leaguesService.knockoutNextStage).mockResolvedValue(QF_GENERATED)
      const { wrapper } = await mountPanel(makeKnockoutState({ manual_phase_games: manual }))

      await find(wrapper, 'knockout-generate').trigger('click')
      await flushPromises()

      const dialog = activeDialog()!
      expect(dialog.querySelector('[data-test="knockout-dialog-manual"]')?.textContent).toContain(
        `A liga tem ${manual.total} partidas de mata-mata cadastradas manualmente. Elas serão apagadas antes de gerar o mata-mata.`,
      )
      expect(dialog.querySelector('[data-test="knockout-dialog-manual-results"]') !== null).toBe(
        highlighted,
      )
      if (highlighted) {
        expect(dialog.textContent).toContain(
          '1 delas tem resultado ou eventos, que também serão perdidos.',
        )
      }
      const confirm = dialog.querySelector('[data-test="knockout-dialog-confirm"]')!
      expect(confirm.textContent?.trim()).toBe('Apagar e gerar')

      await click('.v-dialog.v-overlay--active [data-test="knockout-dialog-confirm"]')
      expect(leaguesService.knockoutNextStage).toHaveBeenCalledWith(7, {
        stage: 'QF',
        replace_manual_phases: true,
      })
    },
  )

  it('gerar sem clique duplo: o botão fica em loading até a resposta', async () => {
    let resolve!: (state: LeagueKnockoutState) => void
    vi.mocked(leaguesService.knockoutNextStage).mockReturnValue(
      new Promise((done) => (resolve = done)),
    )
    const { wrapper } = await mountPanel(makeKnockoutState())

    await find(wrapper, 'knockout-generate').trigger('click')
    await flushPromises()
    await click('.v-dialog.v-overlay--active [data-test="knockout-dialog-confirm"]')

    const generate = find(wrapper, 'knockout-generate')
    expect(generate.attributes('disabled')).toBeDefined()
    expect(generate.classes()).toContain('v-btn--loading')
    await generate.trigger('click')
    await flushPromises()
    expect(activeDialog()).toBeNull()
    expect(leaguesService.knockoutNextStage).toHaveBeenCalledTimes(1)

    resolve(QF_GENERATED)
    await flushPromises()
    expect(find(wrapper, 'knockout-generate').classes()).not.toContain('v-btn--loading')
  })

  it('desfazer a final pede confirmação, avisa do 3º lugar e envia stage = last_stage', async () => {
    const final = makeKnockoutState({
      generated_stages: ['QF', 'SF', '3P', 'F'],
      last_stage: 'F',
      next_stage: null,
      can_generate: false,
      generate_blocked_reason: 'Todas as fases do mata-mata já foram geradas.',
      can_undo: true,
      undo_blocked_reason: null,
    })
    vi.mocked(leaguesService.undoKnockoutStage).mockResolvedValue(QF_GENERATED)
    const { wrapper } = await mountPanel(final)

    expect(find(wrapper, 'knockout-complete').exists()).toBe(true)
    expect(find(wrapper, 'knockout-blocked').exists()).toBe(false)
    expect(find(wrapper, 'knockout-generate').exists()).toBe(false)
    expect(find(wrapper, 'knockout-undo').text()).toBe('Desfazer final e 3º lugar')

    await find(wrapper, 'knockout-undo').trigger('click')
    await flushPromises()
    expect(activeDialog()?.textContent).toContain(
      'As partidas da final serão apagadas. A disputa de 3º lugar também será desfeita.',
    )
    await click('.v-dialog.v-overlay--active .v-card-actions .v-btn:last-child')

    expect(leaguesService.undoKnockoutStage).toHaveBeenCalledWith(7, 'F')
    expect(useSnackbar().message.value).toBe('Final: fase desfeita.')
  })

  it('desfazer bloqueado mostra o motivo do back', async () => {
    const { wrapper } = await mountPanel({
      ...QF_GENERATED,
      can_undo: false,
      undo_blocked_reason:
        'Não é possível desfazer as quartas de final porque há partidas que já começaram ou têm eventos.',
    })

    expect(find(wrapper, 'knockout-undo').attributes('disabled')).toBeDefined()
    expect(find(wrapper, 'knockout-undo-blocked').text()).toContain(
      'Não é possível desfazer as quartas de final',
    )
  })

  it('erro 422 ao gerar aparece na tela e o estado é recarregado', async () => {
    vi.mocked(leaguesService.knockoutNextStage).mockRejectedValue(
      apiError(422, 'As quartas de final já foram geradas.'),
    )
    const { wrapper } = await mountPanel(makeKnockoutState())
    vi.mocked(leaguesService.knockout).mockResolvedValue(QF_GENERATED)

    await find(wrapper, 'knockout-generate').trigger('click')
    await flushPromises()
    await click('.v-dialog.v-overlay--active [data-test="knockout-dialog-confirm"]')

    expect(find(wrapper, 'knockout-error').text()).toContain(
      'As quartas de final já foram geradas.',
    )
    expect(leaguesService.knockout).toHaveBeenCalledTimes(2)
    expect(find(wrapper, 'knockout-undo').exists()).toBe(true)
  })

  it('quem só tem game:read vê o estado e a chave sem botões', async () => {
    const { wrapper } = await mountPanel(QF_GENERATED, { permissions: ['game:read'] })

    expect(find(wrapper, 'knockout-stage').exists()).toBe(true)
    expect(find(wrapper, 'knockout-actions').exists()).toBe(false)
  })

  it('liga sem mata-mata pela classificação mostra o aviso', async () => {
    const { wrapper } = await mountPanel(
      makeKnockoutState({ enabled: false, stages: [], next_stage: null }),
    )

    expect(find(wrapper, 'knockout-not-enabled').exists()).toBe(true)
    expect(find(wrapper, 'knockout-actions').exists()).toBe(false)
  })
})
