import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StadiumAdminListView from '@/views/admin/stadiums/StadiumAdminListView.vue'
import { stadiumsService } from '@/services/api/stadiums.service'
import { useSnackbar } from '@/composables/useSnackbar'
import type { Stadium } from '@/types/stadium'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/stadiums.service', () => ({
  stadiumsService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const stadium: Stadium = {
  id: 3,
  league_id: 7,
  name: 'Barradão',
  city: 'Salvador',
  capacity: 35000,
  created_at: '',
  updated_at: '',
}

async function mountList(permissions: string[], role = 'coach') {
  setupLeagueSession(makeUser(role, permissions), [makeLeague(7, championshipA)])
  const router = createTestRouter()
  await router.push('/admin/liga/7/estadios')
  const wrapper = mount(StadiumAdminListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('StadiumAdminListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(stadiumsService.list).mockResolvedValue([stadium])
  })

  it('lista os estádios da liga ativa (GET /stadiums?league_id=)', async () => {
    const wrapper = await mountList([])

    expect(stadiumsService.list).toHaveBeenCalledWith({ league_id: 7 })
    expect(wrapper.find('[data-test="stadiums-table"] tbody').text()).toContain('Barradão')
  })

  it.each([
    ['sem permissões', 'coach', [] as string[], [false, false, false]],
    ['coach do seeder', 'coach', ['stadium:create', 'stadium:update'], [true, true, false]],
    ['stadium:all', 'admin', ['stadium:all'], [true, true, true]],
    ['master', 'master', [] as string[], [true, true, true]],
  ])('ações por permissão: %s', async (_label, role, permissions, [create, edit, del]) => {
    const wrapper = await mountList(permissions, role)
    expect(wrapper.find('[data-test="stadium-create"]').exists()).toBe(create)
    expect(wrapper.find('[data-test="stadium-edit"]').exists()).toBe(edit)
    expect(wrapper.find('[data-test="stadium-delete"]').exists()).toBe(del)
  })

  it('cria via dialog enviando o league_id da liga ativa e recarrega a lista', async () => {
    vi.mocked(stadiumsService.create).mockResolvedValue({ ...stadium, id: 4 })
    const wrapper = await mountList(['stadium:create'])

    await wrapper.find('[data-test="stadium-create"]').trigger('click')
    await flushPromises()
    const input = document.querySelector('[data-test="stadium-name"] input') as HTMLInputElement
    input.value = 'Fonte Nova'
    input.dispatchEvent(new Event('input'))
    await submit()

    expect(stadiumsService.create).toHaveBeenCalledWith({
      league_id: 7,
      name: 'Fonte Nova',
      city: '',
      capacity: 0,
    })
    expect(stadiumsService.list).toHaveBeenCalledTimes(2)
  })

  it('edita via dialog preenchido e mostra erros 422 nos campos', async () => {
    vi.mocked(stadiumsService.update).mockRejectedValue(
      apiError(422, 'Dados inválidos.', { capacity: ['A capacidade deve ser no mínimo 0.'] }),
    )
    const wrapper = await mountList(['stadium:update'])

    await wrapper.find('[data-test="stadium-edit"]').trigger('click')
    await flushPromises()
    expect((document.querySelector('[data-test="stadium-name"] input') as HTMLInputElement).value).toBe('Barradão')
    await submit()

    expect(stadiumsService.update).toHaveBeenCalledWith(3, expect.objectContaining({ league_id: 7 }))
    expect(document.body.textContent).toContain('A capacidade deve ser no mínimo 0.')
  })

  it('exclusão negada pelo backend mostra a mensagem retornada', async () => {
    vi.mocked(stadiumsService.remove).mockRejectedValue(apiError(403, 'User does not have the right roles.'))
    const wrapper = await mountList(['stadium:delete'], 'admin')

    await wrapper.find('[data-test="stadium-delete"]').trigger('click')
    await flushPromises()
    const confirm = [...document.querySelectorAll('.v-overlay--active button')].find((b) =>
      b.textContent?.includes('Excluir'),
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(useSnackbar().message.value).toBe('User does not have the right roles.')
    expect(wrapper.find('[data-test="stadiums-table"] tbody').text()).toContain('Barradão')
  })
})
