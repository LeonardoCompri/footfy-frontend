import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TechnicalCommitteeMemberFormDialog from '@/components/technicalCommitteeMembers/TechnicalCommitteeMemberFormDialog.vue'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import { createTestVuetify } from '@/test/utils'
import { apiError, makeMember, ROLES } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/technicalCommitteeMembers.service', () => ({
  technicalCommitteeMembersService: { roles: vi.fn(), create: vi.fn(), update: vi.fn() },
}))

async function mountDialog(member: ReturnType<typeof makeMember> | null = null) {
  const wrapper = mount(TechnicalCommitteeMemberFormDialog, {
    props: { modelValue: true, teamId: 5, member },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('TechnicalCommitteeMemberFormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(technicalCommitteeMembersService.roles).mockResolvedValue(ROLES)
  })

  it('não pergunta o time e usa o select de Função alimentado pelo backend', async () => {
    const wrapper = await mountDialog()

    const labels = [...document.querySelectorAll('.v-overlay--active .v-field-label:not(.v-field-label--floating)')]
      .map((l) => l.textContent?.trim())
    expect(labels).toEqual(['Nome', 'Função', 'Data de nascimento'])
    expect(wrapper.findComponent({ name: 'VSelect' }).props('items')).toEqual(ROLES)
  })

  it('edita com team_id implícito do contexto', async () => {
    const member = makeMember(20, 'Fulano', { team_id: 5, birth_date: '1980-12-01' })
    vi.mocked(technicalCommitteeMembersService.update).mockResolvedValue(member)
    const wrapper = await mountDialog(member)

    wrapper.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 'Preparador Físico')
    await submit()

    expect(technicalCommitteeMembersService.update).toHaveBeenCalledWith(20, {
      team_id: 5,
      name: 'Fulano',
      role: 'Preparador Físico',
      birth_date: '1980-12-01',
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([member])
  })

  it('reflete os erros de validação (422) nos campos', async () => {
    vi.mocked(technicalCommitteeMembersService.create).mockRejectedValue(
      apiError(422, 'Dados inválidos.', { role: ['O campo função é obrigatório.'] }),
    )
    const wrapper = await mountDialog()
    await submit()

    expect(document.body.textContent).toContain('O campo função é obrigatório.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
