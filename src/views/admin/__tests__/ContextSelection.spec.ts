import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChampionshipSelectView from '@/views/admin/context/ChampionshipSelectView.vue'
import LeagueSelectView from '@/views/admin/context/LeagueSelectView.vue'
import { useAuthStore } from '@/stores/auth'
import { leaguesService } from '@/services/api/leagues.service'
import {
  championshipA,
  championshipB,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
} from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), dashboard: vi.fn() },
}))

const listLeagues = vi.mocked(leaguesService.list)

async function mountView(component: object, path: string, props: Record<string, unknown> = {}) {
  const router = createTestRouter()
  await router.push(path)
  const wrapper = mount(component, {
    props,
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return wrapper
}

function login(role: string) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser(role)
}

describe('Seleção de Campeonato', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    listLeagues.mockReset()
  })

  it('lista só os campeonatos das ligas acessíveis ao usuário', async () => {
    login('admin')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA), makeLeague(3, championshipA)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    const cards = wrapper.findAll('[data-test="championship-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('Brasileiro')
    expect(cards[0].text()).toContain('2 ligas disponíveis')
    expect(cards[0].attributes('href')).toBe('/admin/selecionar/1')
    expect(wrapper.text()).not.toContain('Gerenciar campeonatos')
  })

  it('master vê todos os campeonatos e o atalho de gestão', async () => {
    login('master')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA), makeLeague(2, championshipB)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    expect(wrapper.findAll('[data-test="championship-card"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Gerenciar campeonatos')
  })

  it('usuário sem liga vinculada vê mensagem clara em vez de erro', async () => {
    login('coach')
    listLeagues.mockResolvedValue([])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    expect(wrapper.find('[data-test="empty-state"]').text()).toContain(
      'Nenhuma liga está vinculada ao seu usuário',
    )
  })

  it('avisa quando chegou aqui por tentar abrir uma liga sem acesso', async () => {
    login('admin')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar?negado=1')

    expect(wrapper.find('[data-test="access-denied"]').exists()).toBe(true)
  })
})

describe('Seleção de Liga', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    listLeagues.mockReset()
    login('admin')
  })

  it('lista as ligas do campeonato escolhido apontando para o Dashboard', async () => {
    listLeagues.mockResolvedValue([
      makeLeague(1, championshipA, { name: 'Série A' }),
      makeLeague(2, championshipB, { name: 'Copa SP' }),
      makeLeague(3, championshipA, { name: 'Série B', format: 'knockout' }),
    ])

    const wrapper = await mountView(LeagueSelectView, '/admin/selecionar/1', { championshipId: '1' })

    const cards = wrapper.findAll('[data-test="league-card"]')
    expect(cards.map((c) => c.find('.v-card-title').text())).toEqual(['Série A', 'Série B'])
    expect(cards[1].text()).toContain('Mata-mata')
    expect(cards[0].attributes('href')).toBe('/admin/liga/1')
  })

  it('campeonato sem ligas acessíveis mostra estado vazio', async () => {
    listLeagues.mockResolvedValue([makeLeague(2, championshipB)])

    const wrapper = await mountView(LeagueSelectView, '/admin/selecionar/1', { championshipId: '1' })

    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(true)
  })
})
