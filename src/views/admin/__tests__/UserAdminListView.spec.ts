import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UserAdminListView from '@/views/admin/users/UserAdminListView.vue'
import { usersService } from '@/services/api/users.service'
import {
  championshipA,
  championshipB,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { makeAppUser } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/users.service', () => ({
  usersService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    attachLeagues: vi.fn(),
    detachLeague: vi.fn(),
  },
}))

const master = makeAppUser(1, 'Dono', 'master')
const admin = makeAppUser(2, 'Ana Admin', 'admin', { leagues: [{ id: 1, name: 'Série A' }] })
const coach = makeAppUser(3, 'Tite', 'coach')

// `makeUser` (sessão) usa id 1: como master, a pessoa logada é o próprio "Dono".
async function mountList(role: 'master' | 'admin') {
  setupLeagueSession(makeUser(role), [
    makeLeague(1, championshipA, { name: 'Série A' }),
    makeLeague(2, championshipB, { name: 'Copa' }),
  ])
  const router = createTestRouter()
  await router.push('/admin/liga/1/usuarios')
  const wrapper = mount(UserAdminListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function rowOf(wrapper: VueWrapper, name: string) {
  const row = wrapper.findAll('[data-test="users-table"] tbody tr').find((tr) => tr.text().includes(name))
  if (!row) throw new Error(`linha ${name} não encontrada`)
  return row
}

async function setInput(selector: string, value: string) {
  const input = document.querySelector(`${selector} input`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('UserAdminListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.innerWidth = 1366
    vi.mocked(usersService.list).mockResolvedValue([master, admin, coach])
  })

  it('lista usuários com papel e ligas vinculadas', async () => {
    const wrapper = await mountList('master')

    expect(usersService.list).toHaveBeenCalled()
    expect(rowOf(wrapper, 'Dono').text()).toContain('Todas as ligas')
    expect(rowOf(wrapper, 'Ana Admin').text()).toContain('Admin')
    expect(rowOf(wrapper, 'Ana Admin').text()).toContain('Série A')
    expect(rowOf(wrapper, 'Tite').text()).toContain('Técnico')
    expect(rowOf(wrapper, 'Tite').text()).toContain('Nenhuma liga')
  })

  it('master: cria, edita, exclui (menos a si mesmo) e gerencia ligas (menos de master)', async () => {
    const wrapper = await mountList('master')

    expect(wrapper.find('[data-test="user-create"]').exists()).toBe(true)
    const self = rowOf(wrapper, 'Dono')
    expect(self.find('[data-test="user-edit"]').exists()).toBe(true)
    expect(self.find('[data-test="user-delete"]').exists()).toBe(false)
    expect(self.find('[data-test="user-leagues-open"]').exists()).toBe(false)
    const other = rowOf(wrapper, 'Tite')
    expect(other.find('[data-test="user-edit"]').exists()).toBe(true)
    expect(other.find('[data-test="user-delete"]').exists()).toBe(true)
    expect(other.find('[data-test="user-leagues-open"]').exists()).toBe(true)
  })

  it('admin: só edita dados básicos de não-master, sem criar/excluir/vincular ligas', async () => {
    const wrapper = await mountList('admin')

    expect(wrapper.find('[data-test="user-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="user-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="user-leagues-open"]').exists()).toBe(false)
    expect(rowOf(wrapper, 'Dono').find('[data-test="user-edit"]').exists()).toBe(false)

    vi.mocked(usersService.update).mockResolvedValue({ ...coach, name: 'Adenor' })
    await rowOf(wrapper, 'Tite').find('[data-test="user-edit"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="user-role"]')).toBeNull()
    await setInput('[data-test="user-name"]', 'Adenor')
    await submit()

    // Sem `role` (o backend ignoraria) e sem senha quando o campo fica em branco.
    expect(usersService.update).toHaveBeenCalledWith(3, {
      name: 'Adenor',
      document: coach.document,
      email: null,
    })
    expect(rowOf(wrapper, 'Adenor').exists()).toBe(true)
  })

  it('cria usuário pelo dialog e vincula às ligas escolhidas (padrão: liga ativa)', async () => {
    const created = makeAppUser(9, 'Novo', 'coach')
    vi.mocked(usersService.create).mockResolvedValue(created)
    vi.mocked(usersService.attachLeagues).mockResolvedValue({ ...created, leagues: [{ id: 1, name: 'Série A' }] })
    const wrapper = await mountList('master')

    await wrapper.find('[data-test="user-create"]').trigger('click')
    await flushPromises()
    await setInput('[data-test="user-name"]', 'Novo')
    await setInput('[data-test="user-document"]', '123.456.789-01')
    await setInput('[data-test="user-password"]', 'segredo1')
    const role = wrapper.findAllComponents({ name: 'VSelect' }).find((c) => c.attributes('data-test') === 'user-role')
    role!.vm.$emit('update:modelValue', 'coach')
    await flushPromises()
    await submit()

    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Novo',
      document: '12345678901',
      email: null,
      password: 'segredo1',
      role: 'coach',
    })
    expect(usersService.attachLeagues).toHaveBeenCalledWith(9, [1])
    expect(rowOf(wrapper, 'Novo').text()).toContain('Série A')
  })

  it('dialog de ligas vincula e desvincula o usuário', async () => {
    vi.mocked(usersService.attachLeagues).mockResolvedValue({
      ...admin,
      leagues: [
        { id: 1, name: 'Série A' },
        { id: 2, name: 'Copa' },
      ],
    })
    vi.mocked(usersService.detachLeague).mockResolvedValue({ ...admin, leagues: [{ id: 2, name: 'Copa' }] })
    const wrapper = await mountList('master')

    await rowOf(wrapper, 'Ana Admin').find('[data-test="user-leagues-open"]').trigger('click')
    await flushPromises()
    const toggles = () => [...document.querySelectorAll('[data-test="league-link-toggle"]')] as HTMLButtonElement[]
    expect(toggles().map((b) => b.textContent?.trim())).toEqual(['Desvincular', 'Vincular'])

    toggles()[1].click()
    await flushPromises()
    expect(usersService.attachLeagues).toHaveBeenCalledWith(2, [2])
    expect(toggles().map((b) => b.textContent?.trim())).toEqual(['Desvincular', 'Desvincular'])

    toggles()[0].click()
    await flushPromises()
    expect(usersService.detachLeague).toHaveBeenCalledWith(2, 1)
    expect(rowOf(wrapper, 'Ana Admin').text()).toContain('Copa')
    expect(rowOf(wrapper, 'Ana Admin').text()).not.toContain('Série A')
  })
})
