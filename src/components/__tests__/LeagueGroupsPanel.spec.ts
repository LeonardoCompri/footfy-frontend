import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LeagueGroupsPanel from '@/components/leagues/LeagueGroupsPanel.vue'
import { leaguesService } from '@/services/api/leagues.service'
import { createTestVuetify } from '@/test/utils'
import { apiError } from '@/test/factories'
import type { GroupTeam, LeagueGroups } from '@/types/leagueRules'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { saveGroups: vi.fn(), shuffleGroups: vi.fn() },
}))

const team = (id: number, name: string): GroupTeam => ({ id, name, nickname: null, logo: null })
const [BAHIA, NAUTICO, SPORT, VITORIA] = [
  team(1, 'Bahia'),
  team(2, 'Náutico'),
  team(3, 'Sport'),
  team(4, 'Vitória'),
]

function groupsData(extra: Partial<LeagueGroups> = {}): LeagueGroups {
  return {
    league_id: 7,
    fixture_mode: 'draw',
    groups_count: 2,
    locked: false,
    groups: [
      { group_number: 1, teams: [] },
      { group_number: 2, teams: [] },
    ],
    unassigned: [BAHIA, NAUTICO, SPORT, VITORIA],
    ...extra,
  }
}

const ASSIGNED = groupsData({
  groups: [
    { group_number: 1, teams: [BAHIA, NAUTICO] },
    { group_number: 2, teams: [SPORT, VITORIA] },
  ],
  unassigned: [],
})

function mountPanel(data: LeagueGroups) {
  return mount(LeagueGroupsPanel, {
    props: { leagueId: 7, data },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
}

function cards(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll('[data-test="group-card"]').map((card) => ({
    title: card.find('[data-test="group-title"]').text(),
    teams: card.findAll('[data-test="group-team"] .v-list-item-title').map((t) => t.text()),
  }))
}

async function moveTeam(wrapper: ReturnType<typeof mountPanel>, name: string, groupNumber: number) {
  const select = wrapper
    .findAllComponents({ name: 'VSelect' })
    .find((s) => s.find(`input[aria-label="Grupo de ${name}"]`).exists())
  select!.vm.$emit('update:modelValue', groupNumber)
  await flushPromises()
}

describe('LeagueGroupsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('mostra os grupos A e B e a lista de sem grupo', () => {
    const wrapper = mountPanel(groupsData())

    expect(cards(wrapper)).toEqual([
      { title: 'Grupo A', teams: [] },
      { title: 'Grupo B', teams: [] },
    ])
    expect(wrapper.find('[data-test="groups-unassigned"]').text()).toContain('Sem grupo')
    expect(
      wrapper.findAll('[data-test="groups-unassigned"] [data-test="group-team"]'),
    ).toHaveLength(4)
    expect(wrapper.find('[data-test="groups-save"]').attributes('disabled')).toBeDefined()
  })

  it('troca manual pelo select e salva com PUT /leagues/{id}/groups', async () => {
    vi.mocked(leaguesService.saveGroups).mockResolvedValue(ASSIGNED)
    const wrapper = mountPanel(groupsData())

    await moveTeam(wrapper, 'Bahia', 1)
    await moveTeam(wrapper, 'Náutico', 1)
    await moveTeam(wrapper, 'Sport', 2)
    await moveTeam(wrapper, 'Vitória', 2)
    expect(cards(wrapper)).toEqual([
      { title: 'Grupo A', teams: ['Bahia', 'Náutico'] },
      { title: 'Grupo B', teams: ['Sport', 'Vitória'] },
    ])
    expect(wrapper.find('[data-test="groups-unassigned"]').exists()).toBe(false)

    await wrapper.find('[data-test="groups-save"]').trigger('click')
    await flushPromises()

    expect(leaguesService.saveGroups).toHaveBeenCalledWith(7, [
      { team_id: 1, group_number: 1 },
      { team_id: 2, group_number: 1 },
      { team_id: 3, group_number: 2 },
      { team_id: 4, group_number: 2 },
    ])
    expect(wrapper.emitted('updated')).toEqual([[ASSIGNED]])
  })

  it('não envia com time sem grupo ou grupos de tamanhos diferentes', async () => {
    const wrapper = mountPanel(groupsData())

    await moveTeam(wrapper, 'Bahia', 1)
    await wrapper.find('[data-test="groups-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="groups-error"]').text()).toBe(
      'Todos os times da liga devem ser atribuídos a um grupo.',
    )

    await moveTeam(wrapper, 'Náutico', 1)
    await moveTeam(wrapper, 'Sport', 1)
    await moveTeam(wrapper, 'Vitória', 2)
    await wrapper.find('[data-test="groups-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="groups-error"]').text()).toBe(
      'Todos os grupos devem ter o mesmo número de times (2 por grupo).',
    )
    expect(leaguesService.saveGroups).not.toHaveBeenCalled()
  })

  it('distribui aleatoriamente direto quando ainda não há grupos montados', async () => {
    vi.mocked(leaguesService.shuffleGroups).mockResolvedValue(ASSIGNED)
    const wrapper = mountPanel(groupsData())

    await wrapper.find('[data-test="groups-shuffle"]').trigger('click')
    await flushPromises()

    expect(leaguesService.shuffleGroups).toHaveBeenCalledWith(7)
    expect(wrapper.emitted('updated')).toEqual([[ASSIGNED]])
  })

  it('pede confirmação antes de redistribuir grupos já montados', async () => {
    vi.mocked(leaguesService.shuffleGroups).mockResolvedValue(ASSIGNED)
    const wrapper = mountPanel(ASSIGNED)

    await wrapper.find('[data-test="groups-shuffle"]').trigger('click')
    await flushPromises()
    expect(leaguesService.shuffleGroups).not.toHaveBeenCalled()
    const dialog = document.querySelector('.v-dialog.v-overlay--active')
    expect(dialog?.textContent).toContain('será substituída')

    const confirm = [...dialog!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Distribuir'),
    )
    confirm!.click()
    await flushPromises()
    expect(leaguesService.shuffleGroups).toHaveBeenCalledWith(7)
  })

  it('mostra a mensagem do backend quando o sorteio dos grupos falha', async () => {
    vi.mocked(leaguesService.shuffleGroups).mockRejectedValue(
      apiError(422, 'Cada grupo precisa ter pelo menos 2 times.'),
    )
    const wrapper = mountPanel(groupsData())

    await wrapper.find('[data-test="groups-shuffle"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="groups-error"]').text()).toBe(
      'Cada grupo precisa ter pelo menos 2 times.',
    )
  })

  it('bloqueia a distribuição quando os times não se dividem nos grupos', () => {
    const wrapper = mountPanel(groupsData({ groups_count: 3, groups: [] }))

    expect(wrapper.find('[data-test="groups-problem"]').text()).toBe(
      'A liga tem 4 times, que não podem ser divididos igualmente em 3 grupos.',
    )
    expect(wrapper.find('[data-test="groups-shuffle"]').attributes('disabled')).toBeDefined()
  })

  it('com rodadas sorteadas fica só leitura', () => {
    const wrapper = mountPanel({ ...ASSIGNED, locked: true })

    expect(wrapper.find('[data-test="groups-locked"]').text()).toContain(
      'A liga já tem rodadas sorteadas',
    )
    expect(wrapper.find('[data-test="groups-shuffle"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="groups-save"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="group-team-select"]').exists()).toBe(false)
    expect(cards(wrapper)[1].teams).toEqual(['Sport', 'Vitória'])
  })
})
