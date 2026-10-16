import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamAdminListView from '@/views/admin/teams/TeamAdminListView.vue'
import { teamsService } from '@/services/api/teams.service'
import { makeTeam } from '@/test/factories'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), attachLeagues: vi.fn() },
}))

async function mountList(permissions: string[], role = 'coach') {
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

describe('TeamAdminListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.mocked(teamsService.list)
      .mockReset()
      .mockResolvedValue([makeTeam(1, 'Vitória FC', { nickname: 'Vitória' }), makeTeam(2, 'Atlético')])
  })

  it('lista apenas os times da liga ativa (GET /teams?league_id=)', async () => {
    const { wrapper } = await mountList([])

    expect(teamsService.list).toHaveBeenCalledWith({ league_id: 7 })
    const cards = wrapper.findAll('[data-test="team-card"]')
    expect(cards.map((c) => c.find('.v-card-title').text())).toEqual(['Vitória FC', 'Atlético'])
  })

  it('filtra pela busca e cada card leva ao detalhe do time na liga ativa', async () => {
    const { wrapper } = await mountList([])

    await wrapper.find('input').setValue('atl')
    const cards = wrapper.findAll('[data-test="team-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].attributes('href')).toBe('/admin/liga/7/times/2')
  })

  it('mostra o escudo no card do time e, sem escudo, as iniciais', async () => {
    vi.mocked(teamsService.list).mockResolvedValue([
      makeTeam(1, 'Vitória FC', { nickname: 'Vitória', logo: 'http://api/storage/teams/v.png' }),
      makeTeam(2, 'Atlético'),
    ])
    const { wrapper } = await mountList([])

    const [withLogo, withoutLogo] = wrapper.findAll('[data-test="team-card"]')
    expect(withLogo.findComponent({ name: 'VImg' }).props('src')).toBe('http://api/storage/teams/v.png')
    expect(withoutLogo.findComponent({ name: 'VImg' }).exists()).toBe(false)
    expect(withoutLogo.find('.v-avatar').text()).toBe('AT')
  })

  it('mostra estado vazio quando a liga não tem times', async () => {
    vi.mocked(teamsService.list).mockResolvedValue([])
    const { wrapper } = await mountList([])

    expect(wrapper.find('[data-test="teams-empty"]').text()).toContain('Nenhum time vinculado')
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
