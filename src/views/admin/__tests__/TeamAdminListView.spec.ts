import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamAdminListView from '@/views/admin/teams/TeamAdminListView.vue'
import { teamsService } from '@/services/api/teams.service'
import { SEARCH_DEBOUNCE_MS } from '@/composables/useServerTable'
import { makePage, makeTeam } from '@/test/factories'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import type { TeamListParams } from '@/types/team'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: {
    list: vi.fn(),
    listPaginated: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    attachLeagues: vi.fn(),
  },
}))

const BASE: TeamListParams = { page: 1, per_page: 20, league_id: 7 }

async function mountList(permissions: string[] = [], role = 'coach') {
  setupLeagueSession(makeUser(role, permissions), [
    makeLeague(7, championshipA, { name: 'Série B' }),
    makeLeague(1, championshipA),
  ])
  const router = createTestRouter()
  await router.push('/admin/liga/7/times')
  const wrapper = mount(TeamAdminListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

function lastQuery(): TeamListParams {
  return vi.mocked(teamsService.listPaginated).mock.lastCall![0]
}

function rows(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="teams-table"] tbody tr')
}

function teamNames(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="team-name"]').map((el) => el.text())
}

async function nextPage(wrapper: VueWrapper) {
  await wrapper
    .find('[data-test="teams-table"] button[aria-label="Próxima página"]')
    .trigger('click')
  await flushPromises()
}

function header(wrapper: VueWrapper, title: string) {
  const th = wrapper
    .findAll('[data-test="teams-table"] thead th')
    .find((cell) => cell.text() === title)
  if (!th) throw new Error(`coluna ${title} não encontrada`)
  return th
}

describe('TeamAdminListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.innerWidth = 1366
    vi.mocked(teamsService.listPaginated).mockResolvedValue(
      makePage([makeTeam(1, 'Vitória FC', { nickname: 'Vitória' }), makeTeam(2, 'Atlético')], {
        total: 45,
        last_page: 3,
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('busca só a 1ª página dos times da liga ativa, sem carregar a lista inteira', async () => {
    const { wrapper } = await mountList()

    expect(teamsService.listPaginated).toHaveBeenCalledTimes(1)
    expect(teamsService.listPaginated).toHaveBeenCalledWith(BASE)
    expect(teamsService.list).not.toHaveBeenCalled()
    expect(teamNames(wrapper)).toEqual(['Vitória FC', 'Atlético'])
    expect(wrapper.find('[data-test="teams-table"]').text()).toContain('1-20 de 45')
  })

  it('o olho e o clique na linha levam ao detalhe do time na liga ativa', async () => {
    const { wrapper, router } = await mountList()
    const push = vi.spyOn(router, 'push')

    const view = rows(wrapper)[1].find('[data-test="team-view"]')
    expect(view.attributes('href')).toBe('/admin/liga/7/times/2')
    expect(view.attributes('aria-label')).toBe('Ver time Atlético')

    await rows(wrapper)[1].trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({
      name: 'admin-teams-detail',
      params: { leagueId: 7, teamId: 2 },
    })
  })

  it('mostra o escudo do time e, sem escudo, as iniciais', async () => {
    vi.mocked(teamsService.listPaginated).mockResolvedValue(
      makePage([
        makeTeam(1, 'Vitória FC', { nickname: 'Vitória', logo: 'http://api/storage/teams/v.png' }),
        makeTeam(2, 'Atlético'),
      ]),
    )
    const { wrapper } = await mountList()

    const [withLogo, withoutLogo] = rows(wrapper)
    expect(withLogo.findComponent({ name: 'VImg' }).props('src')).toBe(
      'http://api/storage/teams/v.png',
    )
    expect(withoutLogo.findComponent({ name: 'VImg' }).exists()).toBe(false)
    expect(withoutLogo.find('.v-avatar').text()).toBe('AT')
    expect(withoutLogo.findAll('td')[1].text()).toBe('—')
  })

  it('mostra estado vazio quando a liga não tem times', async () => {
    vi.mocked(teamsService.listPaginated).mockResolvedValue(makePage([]))
    const { wrapper } = await mountList()

    expect(wrapper.find('[data-test="teams-table"]').text()).toContain(
      'Nenhum time vinculado a esta liga ainda.',
    )
  })

  it('a busca vai para o servidor depois do debounce e volta para a página 1', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { wrapper } = await mountList()
    await nextPage(wrapper)
    expect(lastQuery()).toEqual({ ...BASE, page: 2 })

    await wrapper.find('[data-test="teams-search"] input').setValue('atl')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    await flushPromises()
    expect(teamsService.listPaginated).toHaveBeenCalledTimes(2)

    vi.mocked(teamsService.listPaginated).mockResolvedValue(makePage([]))
    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(teamsService.listPaginated).toHaveBeenCalledTimes(3)
    expect(lastQuery()).toEqual({ ...BASE, search: 'atl' })
    expect(wrapper.find('[data-test="teams-table"]').text()).toContain(
      'Nenhum time encontrado para a busca.',
    )
  })

  it('digitar várias letras seguidas faz uma única busca', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { wrapper } = await mountList()

    for (const term of ['v', 'vi', 'vit']) {
      await wrapper.find('[data-test="teams-search"] input').setValue(term)
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await flushPromises()

    expect(teamsService.listPaginated).toHaveBeenCalledTimes(2)
    expect(lastQuery()).toEqual({ ...BASE, search: 'vit' })
  })

  it.each([
    ['Time', 'name'],
    ['Apelido', 'nickname'],
  ])('ordenar pela coluna %s manda sort=%s e alterna asc/desc', async (title, field) => {
    const { wrapper } = await mountList()

    await header(wrapper, title).trigger('click')
    await flushPromises()
    expect(lastQuery()).toEqual({ ...BASE, sort: field, order: 'asc' })

    await header(wrapper, title).trigger('click')
    await flushPromises()
    expect(lastQuery()).toEqual({ ...BASE, sort: field, order: 'desc' })
  })

  it('ordenar a partir da página 2 volta para a página 1', async () => {
    const { wrapper } = await mountList()
    await nextPage(wrapper)

    await header(wrapper, 'Time').trigger('click')
    await flushPromises()

    expect(lastQuery()).toEqual({ ...BASE, sort: 'name', order: 'asc' })
  })

  it('só Time e Apelido são ordenáveis', async () => {
    const { wrapper } = await mountList()

    const sortable = wrapper
      .findAll('[data-test="teams-table"] thead th.v-data-table__th--sortable')
      .map((th) => th.text())
    expect(sortable).toEqual(['Time', 'Apelido'])
  })

  it('mobile (xs): sem coluna Apelido, o apelido vira legenda sob o nome', async () => {
    window.innerWidth = 375
    const { wrapper } = await mountList()

    const headers = wrapper.findAll('[data-test="teams-table"] thead th').map((th) => th.text())
    expect(headers).not.toContain('Apelido')
    expect(rows(wrapper)[0].find('.text-caption').text()).toBe('Vitória')
  })

  it.each([
    ['sem team:create', 'coach', [] as string[], false],
    ['com team:create', 'admin', ['team:create'], true],
    ['com team:all', 'admin', ['team:all'], true],
    ['master (atalho)', 'master', [] as string[], true],
  ])('botão "Novo time" %s', async (_label, role, permissions, visible) => {
    const { wrapper } = await mountList(permissions, role)
    expect(wrapper.find('[data-test="team-create"]').exists()).toBe(visible)
  })
})
