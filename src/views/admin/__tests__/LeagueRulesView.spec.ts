import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LeagueRulesView from '@/views/admin/leagues/LeagueRulesView.vue'
import LeagueGroupsPanel from '@/components/leagues/LeagueGroupsPanel.vue'
import { leaguesService } from '@/services/api/leagues.service'
import { useSnackbar } from '@/composables/useSnackbar'
import {
  championshipA,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError } from '@/test/factories'
import type { League } from '@/types/championship'
import type { GroupTeam, LeagueGroups } from '@/types/leagueRules'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    groups: vi.fn(),
    saveGroups: vi.fn(),
    shuffleGroups: vi.fn(),
  },
}))

const teams: GroupTeam[] = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  name: `Time ${String(index + 1).padStart(2, '0')}`,
  nickname: null,
  logo: null,
}))

const HYBRID_DRAW: Partial<League> = {
  format: 'hybrid',
  fixture_mode: 'draw',
  groups_count: 4,
  group_legs: 1,
  qualifiers_per_group: 2,
  knockout_size: 8,
  knockout_legs: 1,
  final_legs: 1,
  third_place: false,
  tiebreakers: null,
  knockout_tiebreakers: ['penalties'],
}

function groupsData(extra: Partial<LeagueGroups> = {}): LeagueGroups {
  return {
    league_id: 7,
    fixture_mode: 'manual',
    groups_count: 1,
    locked: false,
    groups: [{ group_number: 1, teams }],
    unassigned: [],
    ...extra,
  }
}

const ASSIGNED_GROUPS = groupsData({
  fixture_mode: 'draw',
  groups_count: 4,
  groups: [0, 1, 2, 3].map((index) => ({
    group_number: index + 1,
    teams: teams.slice(index * 4, index * 4 + 4),
  })),
  unassigned: [],
})

async function mountView(
  league: Partial<League>,
  groups: LeagueGroups = groupsData(),
  permissions = ['tournament:update'],
) {
  const data = makeLeague(7, championshipA, { name: 'Série A', ...league })
  setupLeagueSession(makeUser('admin', permissions), [data])
  vi.mocked(leaguesService.get).mockResolvedValue(data)
  vi.mocked(leaguesService.groups).mockResolvedValue(groups)
  vi.mocked(leaguesService.list).mockResolvedValue([data])
  const wrapper = mount(LeagueRulesView, {
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function field(wrapper: VueWrapper, dataTest: string) {
  const found = wrapper
    .findAllComponents({ name: 'VSelect' })
    .find((select) => select.attributes('data-test') === dataTest)
  if (!found) throw new Error(`Campo ${dataTest} não encontrado`)
  return found
}

async function choose(wrapper: VueWrapper, dataTest: string, value: unknown) {
  field(wrapper, dataTest).vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function errorOf(wrapper: VueWrapper, dataTest: string) {
  return wrapper.find(`[data-test="${dataTest}"] .v-messages`).text()
}

describe('Regulamento da liga', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('liga com sorteio salvo tem link para a tela Sorteio (quem tem game:read)', async () => {
    const draw = await mountView(HYBRID_DRAW, ASSIGNED_GROUPS, ['tournament:update', 'game:read'])
    expect(draw.find('[data-test="rules-draw-link"]').exists()).toBe(true)
    draw.unmount()

    setActivePinia(createPinia())
    const manual = await mountView({ ...HYBRID_DRAW, fixture_mode: 'manual' }, groupsData(), [
      'tournament:update',
      'game:read',
    ])
    expect(manual.find('[data-test="rules-draw-link"]').exists()).toBe(false)
  })

  it('carrega a liga e os grupos e mostra o resumo ao vivo', async () => {
    const wrapper = await mountView(HYBRID_DRAW, ASSIGNED_GROUPS)

    expect(leaguesService.get).toHaveBeenCalledWith(7)
    expect(leaguesService.groups).toHaveBeenCalledWith(7)
    expect(wrapper.find('[data-test="rules-format"] input').element).toHaveProperty(
      'value',
      'Grupos + mata-mata',
    )
    expect(wrapper.find('[data-test="rules-summary"]').text()).toBe(
      '16 times → 4 grupos de 4 → 8 classificados → Quartas de final',
    )

    await choose(wrapper, 'rules-groups-count', 3)
    expect(wrapper.find('[data-test="rules-summary-problem"]').text()).toBe(
      '16 times não podem ser divididos igualmente em 3 grupos.',
    )
  })

  it('pontos corridos esconde o mata-mata e o número de grupos', async () => {
    const wrapper = await mountView({ format: 'round_robin' })

    expect(wrapper.find('[data-test="rules-knockout"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rules-group-stage"]').text()).toContain('Pontos corridos')
    expect(wrapper.find('[data-test="rules-groups-count"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="tiebreakers"]').exists()).toBe(true)
  })

  it('mata-mata avisa que o sorteio não se aplica e trava a tabela em manual', async () => {
    const wrapper = await mountView({ format: 'knockout' })

    expect(wrapper.find('[data-test="rules-knockout-manual"]').exists()).toBe(true)
    expect(field(wrapper, 'rules-fixture-mode').props('disabled')).toBe(true)
    expect(wrapper.find('[data-test="rules-group-stage"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rules-knockout"]').exists()).toBe(true)
  })

  it('salva só os campos do regulamento com PUT /leagues/{id} e recarrega os grupos', async () => {
    const saved = makeLeague(7, championshipA, { ...HYBRID_DRAW, name: 'Série A' })
    vi.mocked(leaguesService.update).mockResolvedValue(saved)
    const wrapper = await mountView({ format: 'hybrid' })

    await choose(wrapper, 'rules-fixture-mode', 'draw')
    await choose(wrapper, 'rules-groups-count', 4)
    await choose(wrapper, 'rules-qualifiers', 2)
    await choose(wrapper, 'rules-knockout-size', 8)
    await choose(wrapper, 'rules-knockout-legs', 1)
    await choose(wrapper, 'rules-final-legs', 1)
    await choose(wrapper, 'rules-knockout-tiebreakers', 'penalties')
    expect(wrapper.find('[data-test="groups-pending"]').exists()).toBe(true)

    vi.mocked(leaguesService.groups).mockResolvedValue({
      ...ASSIGNED_GROUPS,
      groups: [],
      unassigned: teams,
    })
    await submit(wrapper)

    expect(leaguesService.update).toHaveBeenCalledWith(7, {
      fixture_mode: 'draw',
      groups_count: 4,
      group_legs: 1,
      qualifiers_per_group: 2,
      knockout_size: 8,
      knockout_legs: 1,
      final_legs: 1,
      third_place: false,
      tiebreakers: null,
      knockout_tiebreakers: ['penalties'],
    })
    expect(leaguesService.groups).toHaveBeenCalledTimes(2)
    expect(leaguesService.list).toHaveBeenCalled()
    expect(useSnackbar().message.value).toBe('Regulamento salvo com sucesso.')
    expect(wrapper.findComponent(LeagueGroupsPanel).exists()).toBe(true)
    expect(wrapper.find('[data-test="groups-pending"]').exists()).toBe(false)
  })

  it('bloqueia o envio inválido e mostra o erro em cada campo', async () => {
    const wrapper = await mountView({ format: 'hybrid' })

    await choose(wrapper, 'rules-fixture-mode', 'draw')
    await choose(wrapper, 'rules-groups-count', 4)
    await submit(wrapper)

    expect(leaguesService.update).not.toHaveBeenCalled()
    expect(errorOf(wrapper, 'rules-qualifiers')).toBe('Obrigatório para o sorteio.')
    expect(errorOf(wrapper, 'rules-knockout-size')).toBe('Obrigatório para o sorteio.')
    expect(errorOf(wrapper, 'rules-knockout-tiebreakers')).toBe('Obrigatório para o sorteio.')

    await choose(wrapper, 'rules-qualifiers', 2)
    expect(errorOf(wrapper, 'rules-qualifiers')).toBe('')
  })

  it('gol fora com jogo único é barrado no front', async () => {
    const wrapper = await mountView(HYBRID_DRAW, ASSIGNED_GROUPS)

    await choose(wrapper, 'rules-knockout-tiebreakers', 'away_goals,penalties')
    await submit(wrapper)

    expect(leaguesService.update).not.toHaveBeenCalled()
    expect(errorOf(wrapper, 'rules-knockout-tiebreakers')).toBe(
      'O gol fora de casa só vale com confrontos de ida e volta.',
    )
  })

  it('"Restaurar padrão" envia os critérios como null', async () => {
    vi.mocked(leaguesService.update).mockResolvedValue(
      makeLeague(7, championshipA, { format: 'round_robin' }),
    )
    const wrapper = await mountView({ format: 'round_robin', tiebreakers: ['points', 'goals_for'] })

    await wrapper.find('[data-test="tiebreakers-restore"]').trigger('click')
    await submit(wrapper)

    expect(vi.mocked(leaguesService.update).mock.calls[0][1]).toMatchObject({ tiebreakers: null })
  })

  it('erros 422 do backend aparecem nos campos e a mensagem de trava no alerta', async () => {
    vi.mocked(leaguesService.update).mockRejectedValueOnce(
      apiError(422, 'O campo critério de desempate é inválido.', {
        'tiebreakers.1': ['O campo critério de desempate é inválido.'],
        final_legs: ['O campo jogos da final é inválido.'],
      }),
    )
    const wrapper = await mountView(HYBRID_DRAW, ASSIGNED_GROUPS)

    await submit(wrapper)
    expect(wrapper.find('[data-test="tiebreakers-error"]').text()).toBe(
      'O campo critério de desempate é inválido.',
    )
    expect(errorOf(wrapper, 'rules-final-legs')).toBe('O campo jogos da final é inválido.')

    const lockMessage =
      'O mata-mata e os critérios de desempate da liga não podem ser alterados porque o mata-mata já foi gerado.'
    vi.mocked(leaguesService.update).mockRejectedValueOnce(apiError(422, lockMessage))
    await submit(wrapper)
    expect(wrapper.find('[data-test="rules-error"]').text()).toBe(lockMessage)
  })

  it('com rodadas sorteadas trava modo, grupos e turnos', async () => {
    const wrapper = await mountView(HYBRID_DRAW, { ...ASSIGNED_GROUPS, locked: true })

    expect(wrapper.find('[data-test="rules-locked"]').exists()).toBe(true)
    for (const name of ['rules-fixture-mode', 'rules-groups-count', 'rules-group-legs']) {
      expect(field(wrapper, name).props('disabled')).toBe(true)
    }
    expect(field(wrapper, 'rules-qualifiers').props('disabled')).toBeFalsy()
    expect(wrapper.find('[data-test="groups-locked"]').exists()).toBe(true)
  })

  it('mudar o número de grupos com grupos montados pede confirmação antes de salvar', async () => {
    vi.mocked(leaguesService.update).mockResolvedValue(
      makeLeague(7, championshipA, { ...HYBRID_DRAW, groups_count: 2, qualifiers_per_group: 4 }),
    )
    const wrapper = await mountView(HYBRID_DRAW, ASSIGNED_GROUPS)

    await choose(wrapper, 'rules-groups-count', 2)
    await choose(wrapper, 'rules-qualifiers', 4)
    expect(wrapper.find('[data-test="groups-outdated"]').exists()).toBe(true)
    expect(wrapper.findComponent(LeagueGroupsPanel).props('disabled')).toBe(true)

    await submit(wrapper)
    expect(leaguesService.update).not.toHaveBeenCalled()
    const dialog = document.querySelector('.v-dialog.v-overlay--active')
    expect(dialog?.textContent).toContain('a montagem atual dos grupos será apagada')

    const confirm = [...dialog!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Salvar',
    )
    confirm!.click()
    await flushPromises()
    expect(vi.mocked(leaguesService.update).mock.calls[0][1]).toMatchObject({
      groups_count: 2,
      qualifiers_per_group: 4,
    })
  })

  it('liga de 1 grupo muda para vários grupos sem o aviso de apagar a montagem', async () => {
    vi.mocked(leaguesService.update).mockResolvedValue(
      makeLeague(7, championshipA, { ...HYBRID_DRAW, name: 'Série A' }),
    )
    const wrapper = await mountView(
      {
        ...HYBRID_DRAW,
        groups_count: 1,
        qualifiers_per_group: 8,
      },
      groupsData({ fixture_mode: 'draw' }),
    )

    await choose(wrapper, 'rules-groups-count', 4)
    await choose(wrapper, 'rules-qualifiers', 2)
    await submit(wrapper)

    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()
    expect(vi.mocked(leaguesService.update).mock.calls[0][1]).toMatchObject({
      groups_count: 4,
      qualifiers_per_group: 2,
    })
  })

  it('tabela manual fixa um grupo: select desabilitado com dica e payload com 1 grupo', async () => {
    vi.mocked(leaguesService.update).mockResolvedValue(
      makeLeague(7, championshipA, { format: 'hybrid' }),
    )
    const wrapper = await mountView(
      {
        format: 'hybrid',
        fixture_mode: 'manual',
        groups_count: 4,
        qualifiers_per_group: 4,
        knockout_size: 4,
      },
      groupsData({
        groups_count: 4,
        groups: [1, 2, 3, 4].map((group_number) => ({ group_number, teams: [] })),
        unassigned: teams,
      }),
    )

    const groupsCount = field(wrapper, 'rules-groups-count')
    expect(groupsCount.props('disabled')).toBe(true)
    expect(groupsCount.props('modelValue')).toBe(1)
    expect(errorOf(wrapper, 'rules-groups-count')).toBe(
      'Na tabela manual, a liga tem um único grupo.',
    )
    expect(wrapper.find('[data-test="rules-summary"]').text()).toBe(
      '16 times → 1 grupo de 16 → 4 classificados → Semifinal',
    )

    await choose(wrapper, 'rules-fixture-mode', 'draw')
    expect(groupsCount.props('disabled')).toBeFalsy()
    expect(groupsCount.props('modelValue')).toBe(4)
    expect(errorOf(wrapper, 'rules-groups-count')).toBe('')

    await choose(wrapper, 'rules-fixture-mode', 'manual')
    await submit(wrapper)
    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()
    expect(vi.mocked(leaguesService.update).mock.calls[0][1]).toMatchObject({
      fixture_mode: 'manual',
      groups_count: 1,
      qualifiers_per_group: 4,
      knockout_size: 4,
    })
  })

  it('mudar para manual com grupos montados avisa e salva com 1 grupo', async () => {
    vi.mocked(leaguesService.update).mockResolvedValue(
      makeLeague(7, championshipA, { format: 'hybrid' }),
    )
    const wrapper = await mountView(HYBRID_DRAW, ASSIGNED_GROUPS)

    await choose(wrapper, 'rules-fixture-mode', 'manual')
    await submit(wrapper)
    expect(leaguesService.update).not.toHaveBeenCalled()
    expect(errorOf(wrapper, 'rules-knockout-size')).toBe(
      'O tamanho do mata-mata deve ser igual a grupos × classificados por grupo (2).',
    )

    await choose(wrapper, 'rules-qualifiers', 8)
    await submit(wrapper)
    expect(leaguesService.update).not.toHaveBeenCalled()
    const dialog = document.querySelector('.v-dialog.v-overlay--active')
    expect(dialog?.textContent).toContain('a montagem atual dos grupos será apagada')

    const confirm = [...dialog!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Salvar',
    )
    confirm!.click()
    await flushPromises()
    expect(vi.mocked(leaguesService.update).mock.calls[0][1]).toMatchObject({
      fixture_mode: 'manual',
      groups_count: 1,
      qualifiers_per_group: 8,
      knockout_size: 8,
    })
  })

  it('mostra a mensagem do backend quando os grupos não carregam', async () => {
    const data = makeLeague(7, championshipA, HYBRID_DRAW)
    setupLeagueSession(makeUser('admin', ['tournament:update']), [data])
    vi.mocked(leaguesService.get).mockResolvedValue(data)
    vi.mocked(leaguesService.groups).mockRejectedValue(
      apiError(403, 'Você não tem acesso a esta liga.'),
    )
    const wrapper = mount(LeagueRulesView, { global: { plugins: [createTestVuetify()] } })
    await flushPromises()

    expect(wrapper.find('[data-test="groups-load-error"]').text()).toBe(
      'Você não tem acesso a esta liga.',
    )
    expect(wrapper.find('[data-test="rules-summary"]').text()).toBe(
      '4 grupos → 8 classificados → Quartas de final',
    )
  })
})
