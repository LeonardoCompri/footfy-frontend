import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TechnicalCommitteeMemberDetailView from '@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberDetailView.vue'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import { teamsService } from '@/services/api/teams.service'
import { createTestRouter, createTestVuetify, makeUser, setupLeagueSession } from '@/test/utils'
import { makeMember, makeTeam, ROLES } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { get: vi.fn() } }))
vi.mock('@/services/api/technicalCommitteeMembers.service', () => ({
  technicalCommitteeMembersService: {
    get: vi.fn(),
    roles: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))

const member = makeMember(20, 'Técnico Fulano', { team_id: 5, role: 'Preparador Físico', birth_date: '1980-12-01' })

async function mountDetail(permissions: string[]) {
  setupLeagueSession(makeUser('admin', permissions))
  const router = createTestRouter()
  await router.push('/admin/liga/1/times/5/comissao-tecnica/20')
  const wrapper = mount(TechnicalCommitteeMemberDetailView, {
    props: { teamId: '5', id: '20' },
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('TechnicalCommitteeMemberDetailView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(technicalCommitteeMembersService.get).mockResolvedValue(member)
    vi.mocked(technicalCommitteeMembersService.roles).mockResolvedValue(ROLES)
    vi.mocked(teamsService.get).mockResolvedValue(makeTeam(5, 'Vitória FC'))
  })

  it('é uma tela própria de detalhe com o perfil do membro', async () => {
    const { wrapper } = await mountDetail([])

    expect(technicalCommitteeMembersService.get).toHaveBeenCalledWith('20')
    expect(wrapper.find('[data-test="member-title"]').text()).toBe('Técnico Fulano')
    const profile = wrapper.find('[data-test="member-profile"]').text()
    expect(profile).toContain('Vitória FC')
    expect(profile).toContain('Preparador Físico')
    expect(profile).toContain('01/12/1980')
  })

  it.each([
    [[] as string[], false, false],
    [['technical_committee_member:update'], true, false],
    [['technical_committee_member:all'], true, true],
  ])('permissões %j: editar=%s excluir=%s', async (permissions, canEdit, canDelete) => {
    const { wrapper } = await mountDetail(permissions)
    expect(wrapper.find('[data-test="member-edit"]').exists()).toBe(canEdit)
    expect(wrapper.find('[data-test="member-delete"]').exists()).toBe(canDelete)
  })

  it('excluir confirma e volta para a aba Comissão Técnica do time', async () => {
    vi.mocked(technicalCommitteeMembersService.remove).mockResolvedValue({} as never)
    const { wrapper, router } = await mountDetail(['technical_committee_member:delete'])

    await wrapper.find('[data-test="member-delete"]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('.v-overlay--active') as HTMLElement
    expect(dialog.querySelector('.v-card-title')?.textContent).toBe('Excluir membro')
    expect(dialog.querySelector('.v-card-text')?.textContent).toBe(
      "Tem certeza que deseja excluir 'Técnico Fulano'?",
    )
    const confirm = [...dialog.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(technicalCommitteeMembersService.remove).toHaveBeenCalledWith(20)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-teams-detail'))
    expect(router.currentRoute.value.query).toEqual({ tab: 'comissao' })
  })
})
