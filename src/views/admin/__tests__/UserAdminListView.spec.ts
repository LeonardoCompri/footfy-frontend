import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UserAdminListView from '@/views/admin/users/UserAdminListView.vue'
import { usersService } from '@/services/api/users.service'
import { teamsService } from '@/services/api/teams.service'
import { playersService } from '@/services/api/players.service'
import { SEARCH_DEBOUNCE_MS } from '@/composables/useServerTable'
import {
  championshipA,
  championshipB,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { makeAppUser, makePage, makePlayer, makeTeam } from '@/test/factories'
import type { User } from '@/types/user'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { list: vi.fn() } }))
vi.mock('@/services/api/players.service', () => ({ playersService: { list: vi.fn() } }))
vi.mock('@/services/api/users.service', () => ({
  usersService: {
    list: vi.fn(),
    listPaginated: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    attachLeagues: vi.fn(),
    detachLeague: vi.fn(),
  },
}))

const vitoria = { id: 5, name: 'Vitória FC', logo: null }
const master = makeAppUser(1, 'Dono', 'master')
const admin = makeAppUser(2, 'Ana Admin', 'admin', { leagues: [{ id: 1, name: 'Série A' }] })
const coach = makeAppUser(3, 'Tite', 'coach', { team: vitoria })
const player = makeAppUser(4, 'Joga Bem', 'player', {
  team: vitoria,
  player: { id: 10, name: 'Joga Bem', team_id: 5 },
})
const coachWithoutTeam = makeAppUser(5, 'Sem Time', 'coach', { team: null })
const extraAdmin = makeAppUser(6, 'Beto Admin', 'admin', { leagues: [{ id: 1, name: 'Série A' }] })

async function mountList(role: 'master' | 'admin') {
  setupLeagueSession(makeUser(role, [], { id: role === 'master' ? 1 : 2 }), [
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

function listedNames(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-test="users-table"] tbody tr .font-weight-medium')
    .map((el) => el.text())
}

function mockUsers(users: User[], meta = {}) {
  vi.mocked(usersService.listPaginated).mockResolvedValue(makePage(users, meta))
}

function lastQuery() {
  return vi.mocked(usersService.listPaginated).mock.lastCall![0]
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('UserAdminListView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.innerWidth = 1366
    mockUsers([master, admin, coach])
    vi.mocked(teamsService.list).mockResolvedValue([makeTeam(5, 'Vitória FC')])
    vi.mocked(playersService.list).mockResolvedValue([makePlayer(10, 'Joga Bem', { team_id: 5 })])
  })

  it('lista usuários com papel e ligas vinculadas', async () => {
    const wrapper = await mountList('master')

    expect(usersService.listPaginated).toHaveBeenCalledTimes(1)
    expect(usersService.listPaginated).toHaveBeenCalledWith({ page: 1, per_page: 20 })
    expect(usersService.list).not.toHaveBeenCalled()
    expect(rowOf(wrapper, 'Dono').text()).toContain('Todas as ligas')
    expect(rowOf(wrapper, 'Ana Admin').text()).toContain('Admin')
    expect(rowOf(wrapper, 'Ana Admin').text()).toContain('Série A')
    expect(rowOf(wrapper, 'Tite').text()).toContain('Técnico')
    expect(rowOf(wrapper, 'Tite').text()).toContain('Ligas do time')
  })

  it('coluna Vínculo mostra o time do coach e o jogador do player', async () => {
    mockUsers([master, admin, coach, player, coachWithoutTeam])
    const wrapper = await mountList('master')

    const link = (name: string) => rowOf(wrapper, name).find('[data-test="user-link"]').text()
    expect(link('Tite')).toBe('Time: Vitória FC')
    expect(link('Joga Bem')).toBe('Jogador: Joga Bem (Vitória FC)')
    expect(link('Sem Time')).toBe('Sem time')
    expect(rowOf(wrapper, 'Sem Time').text()).toContain('Nenhuma liga')
    expect(link('Ana Admin')).toBe('—')
  })

  it('mobile (sm): o vínculo vira legenda sob o nome', async () => {
    window.innerWidth = 800
    mockUsers([master, coach])
    const wrapper = await mountList('master')

    expect(wrapper.find('[data-test="user-link"]').exists()).toBe(false)
    expect(rowOf(wrapper, 'Tite').text()).toContain('Time: Vitória FC')
  })

  it('master: cria, edita, exclui (menos a si mesmo) e gerencia ligas só de admin', async () => {
    mockUsers([master, admin, coach, player])
    const wrapper = await mountList('master')

    expect(wrapper.find('[data-test="user-create"]').exists()).toBe(true)
    const self = rowOf(wrapper, 'Dono')
    expect(self.find('[data-test="user-edit"]').exists()).toBe(true)
    expect(self.find('[data-test="user-delete"]').exists()).toBe(false)
    expect(self.find('[data-test="user-leagues-open"]').exists()).toBe(false)
    const other = rowOf(wrapper, 'Ana Admin')
    expect(other.find('[data-test="user-edit"]').exists()).toBe(true)
    expect(other.find('[data-test="user-delete"]').exists()).toBe(true)
    expect(other.find('[data-test="user-leagues-open"]').exists()).toBe(true)
    for (const name of ['Tite', 'Joga Bem']) {
      expect(rowOf(wrapper, name).find('[data-test="user-edit"]').exists()).toBe(true)
      expect(rowOf(wrapper, name).find('[data-test="user-leagues-open"]').exists()).toBe(false)
    }
  })

  it('admin: cria e edita coach/player e a si mesmo, sem excluir, vincular ligas ou editar master/admin', async () => {
    mockUsers([master, admin, extraAdmin, coach, player])
    const wrapper = await mountList('admin')

    expect(wrapper.find('[data-test="user-create"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="user-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="user-leagues-open"]').exists()).toBe(false)
    expect(rowOf(wrapper, 'Dono').find('[data-test="user-edit"]').exists()).toBe(false)
    expect(rowOf(wrapper, 'Beto Admin').find('[data-test="user-edit"]').exists()).toBe(false)
    expect(rowOf(wrapper, 'Ana Admin').find('[data-test="user-edit"]').exists()).toBe(true)
    expect(rowOf(wrapper, 'Joga Bem').find('[data-test="user-edit"]').exists()).toBe(true)

    vi.mocked(usersService.update).mockResolvedValue({ ...coach, name: 'Adenor' })
    await rowOf(wrapper, 'Tite').find('[data-test="user-edit"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="user-role"]')).toBeNull()
    await setInput('[data-test="user-name"]', 'Adenor')
    await submit()

    expect(usersService.update).toHaveBeenCalledWith(3, {
      name: 'Adenor',
      document: coach.document,
      email: null,
      team_id: 5,
    })
    expect(rowOf(wrapper, 'Adenor').exists()).toBe(true)
    expect(usersService.listPaginated).toHaveBeenCalledTimes(1)
  })

  it('master cria admin pelo dialog e vincula às ligas escolhidas (padrão: liga ativa)', async () => {
    const created = makeAppUser(9, 'Novo', 'admin')
    vi.mocked(usersService.create).mockResolvedValue(created)
    vi.mocked(usersService.attachLeagues).mockResolvedValue({ ...created, leagues: [{ id: 1, name: 'Série A' }] })
    const wrapper = await mountList('master')

    await wrapper.find('[data-test="user-create"]').trigger('click')
    await flushPromises()
    await setInput('[data-test="user-name"]', 'Novo')
    await setInput('[data-test="user-document"]', '123.456.789-01')
    await setInput('[data-test="user-password"]', 'segredo1')
    const role = wrapper.findAllComponents({ name: 'VSelect' }).find((c) => c.attributes('data-test') === 'user-role')
    expect(role!.props('modelValue')).toBe('admin')
    mockUsers([master, admin, coach, { ...created, leagues: [{ id: 1, name: 'Série A' }] }])
    await submit()

    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Novo',
      document: '12345678901',
      email: null,
      password: 'segredo1',
      role: 'admin',
    })
    expect(usersService.attachLeagues).toHaveBeenCalledWith(9, [1])
    expect(usersService.listPaginated).toHaveBeenCalledTimes(2)
    expect(rowOf(wrapper, 'Novo').text()).toContain('Série A')
  })

  it('dialog de usuário não salva sem CPF ou com CPF incompleto', async () => {
    const wrapper = await mountList('master')

    await wrapper.find('[data-test="user-create"]').trigger('click')
    await flushPromises()
    await setInput('[data-test="user-name"]', 'Novo')
    await setInput('[data-test="user-password"]', 'segredo1')
    await submit()
    expect(document.body.textContent).toContain('Campo obrigatório.')

    await setInput('[data-test="user-document"]', '123.456.78')
    await submit()
    expect(document.body.textContent).toContain('O CPF deve ter 11 dígitos.')
    expect(usersService.create).not.toHaveBeenCalled()
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

  describe('mobile (xs): ações da linha', () => {
    beforeEach(() => {
      window.innerWidth = 375
      mockUsers([master, admin, extraAdmin, coach])
    })

    const menuItems = () =>
      [...document.querySelectorAll('.v-overlay--active .v-list-item')] as HTMLElement[]

    it('master vendo outro usuário: Ligas, Editar e Excluir num menu; Excluir pede confirmação', async () => {
      const wrapper = await mountList('master')

      const row = rowOf(wrapper, 'Ana Admin')
      expect(row.find('[data-test="user-edit"]').exists()).toBe(false)
      const toggle = row.find('[data-test="row-actions-menu"]')
      expect(toggle.attributes('aria-label')).toBe('Ações de Ana Admin')
      await toggle.trigger('click')
      await flushPromises()

      expect(menuItems().map((item) => item.dataset.test)).toEqual([
        'user-leagues-open',
        'user-edit',
        'user-delete',
      ])
      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        'Ligas do usuário',
        'Editar usuário',
        'Excluir usuário',
      ])
      menuItems()[2].click()
      await flushPromises()
      expect(document.querySelector('.v-dialog.v-overlay--active')?.textContent).toContain(
        "Tem certeza que deseja excluir 'Ana Admin'?",
      )
      expect(usersService.remove).not.toHaveBeenCalled()
    })

    it('master vendo a si mesmo: só o botão Editar, sem menu', async () => {
      const wrapper = await mountList('master')

      const self = rowOf(wrapper, 'Dono')
      expect(self.find('[data-test="row-actions-menu"]').exists()).toBe(false)
      expect(self.find('[data-test="user-edit"]').attributes('aria-label')).toBe('Editar usuário')
    })

    it('admin: Editar direto em coach e em si mesmo; nenhuma ação em master ou outro admin', async () => {
      const wrapper = await mountList('admin')

      expect(wrapper.find('[data-test="row-actions-menu"]').exists()).toBe(false)
      for (const name of ['Tite', 'Ana Admin']) {
        expect(rowOf(wrapper, name).find('[data-test="user-edit"]').exists()).toBe(true)
      }
      for (const name of ['Dono', 'Beto Admin']) {
        expect(rowOf(wrapper, name).findAll('td').at(-1)!.find('button').exists()).toBe(false)
      }
    })
  })

  describe('CPF formatado e busca', () => {
    const withCpf = makeAppUser(4, 'Carlos Cpf', 'coach', {
      document: '12345678901',
      email: 'carlos@footfy.com',
    })

    beforeEach(() => {
      mockUsers([master, admin, coach, withCpf])
    })

    it('desktop: CPF com máscara fica sob o nome, sem coluna própria e sem quebrar', async () => {
      const wrapper = await mountList('master')

      const headers = wrapper.findAll('[data-test="users-table"] thead th').map((th) => th.text())
      expect(headers).not.toContain('CPF')
      const nameCell = rowOf(wrapper, 'Carlos Cpf').findAll('td')[0]
      expect(nameCell.text()).toContain('carlos@footfy.com')
      const cpf = nameCell.find('[data-test="user-cpf"]')
      expect(cpf.text()).toBe('123.456.789-01')
      expect(cpf.classes()).toContain('text-no-wrap')
      expect(rowOf(wrapper, 'Carlos Cpf').text()).not.toContain('12345678901')
    })

    it('mobile (xs): legenda sob o nome mostra o CPF com máscara', async () => {
      window.innerWidth = 375
      const wrapper = await mountList('master')

      const row = rowOf(wrapper, 'Carlos Cpf')
      expect(row.text()).toContain('Técnico · 123.456.789-01')
      expect(row.text()).not.toContain('12345678901')
      expect(row.find('[data-test="user-cpf"]').classes()).toContain('text-no-wrap')
    })

    it('busca vai para o servidor após o debounce, sem espaços e voltando para a página 1', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      mockUsers([master, admin, coach, withCpf], { total: 45, last_page: 3 })
      const wrapper = await mountList('master')
      await wrapper
        .find('[data-test="users-table"] button[aria-label="Próxima página"]')
        .trigger('click')
      await flushPromises()
      expect(lastQuery()).toEqual({ page: 2, per_page: 20 })

      mockUsers([withCpf])
      await setInput('[data-test="users-search"]', ' 123.456.789-01 ')
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
      await flushPromises()
      expect(usersService.listPaginated).toHaveBeenCalledTimes(2)

      vi.advanceTimersByTime(1)
      await flushPromises()
      expect(usersService.listPaginated).toHaveBeenCalledTimes(3)
      expect(lastQuery()).toEqual({ page: 1, per_page: 20, search: '123.456.789-01' })
      expect(listedNames(wrapper)).toEqual(['Carlos Cpf'])
    })

    it('digitar seguido faz uma única busca com o último termo', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      await mountList('master')

      for (const term of ['c', 'ca', 'carlos@foot']) {
        await setInput('[data-test="users-search"]', term)
        vi.advanceTimersByTime(100)
      }
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
      await flushPromises()

      expect(usersService.listPaginated).toHaveBeenCalledTimes(2)
      expect(lastQuery()).toEqual({ page: 1, per_page: 20, search: 'carlos@foot' })
    })

    it('busca sem resultado mostra a mensagem da busca', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const wrapper = await mountList('master')

      mockUsers([])
      await setInput('[data-test="users-search"]', 'ninguém')
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
      await flushPromises()

      expect(listedNames(wrapper)).toEqual([])
      expect(wrapper.find('[data-test="users-table"]').text()).toContain(
        'Nenhum usuário encontrado para a busca.',
      )
    })
  })

  describe('paginação e ordenação no servidor', () => {
    it('ordenar por Nome manda sort=name e alterna asc/desc; só Nome é ordenável', async () => {
      const wrapper = await mountList('master')

      const sortable = () =>
        wrapper.findAll('[data-test="users-table"] thead th.v-data-table__th--sortable')
      expect(sortable().map((th) => th.text())).toEqual(['Nome'])
      await sortable()[0].trigger('click')
      await flushPromises()
      expect(lastQuery()).toEqual({ page: 1, per_page: 20, sort: 'name', order: 'asc' })
      await sortable()[0].trigger('click')
      await flushPromises()
      expect(lastQuery()).toEqual({ page: 1, per_page: 20, sort: 'name', order: 'desc' })
    })

    it('excluir recarrega a página atual do servidor', async () => {
      vi.mocked(usersService.remove).mockResolvedValue({} as never)
      const wrapper = await mountList('master')

      await rowOf(wrapper, 'Ana Admin').find('[data-test="user-delete"]').trigger('click')
      await flushPromises()
      mockUsers([master, coach])
      const confirm = [...document.querySelectorAll('.v-dialog.v-overlay--active button')].find(
        (button) => button.textContent?.trim() === 'Excluir',
      ) as HTMLButtonElement
      confirm.click()
      await flushPromises()

      expect(usersService.remove).toHaveBeenCalledWith(2)
      expect(usersService.listPaginated).toHaveBeenCalledTimes(2)
      expect(listedNames(wrapper)).toEqual(['Dono', 'Tite'])
    })
  })
})
