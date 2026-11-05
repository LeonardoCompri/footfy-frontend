import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChampionshipSelectView from '@/views/admin/context/ChampionshipSelectView.vue'
import LeagueSelectView from '@/views/admin/context/LeagueSelectView.vue'
import { useAuthStore } from '@/stores/auth'
import { leaguesService } from '@/services/api/leagues.service'
import { championshipsService } from '@/services/api/championships.service'
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
vi.mock('@/services/api/championships.service', () => ({
  championshipsService: { list: vi.fn() },
}))

const listLeagues = vi.mocked(leaguesService.list)
const listChampionships = vi.mocked(championshipsService.list)
const championshipC = { id: 3, name: 'Copa Nova', image: null }

async function mountView(component: object, path: string, props: Record<string, unknown> = {}) {
  const router = createTestRouter()
  await router.push(path)
  const wrapper = mount(component, {
    props,
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return Object.assign(wrapper, { router })
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
    listChampionships.mockReset()
    listChampionships.mockResolvedValue([])
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

  it('master vê o campeonato sem ligas com o texto "Sem ligas"', async () => {
    login('master')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA)])
    listChampionships.mockResolvedValue([championshipA, championshipC])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    const cards = wrapper.findAll('[data-test="championship-card"]')
    expect(cards.map((c) => c.find('.v-card-title').text())).toEqual(['Brasileiro', 'Copa Nova'])
    expect(cards[0].find('.v-card-subtitle').text()).toBe('1 liga disponível')
    expect(cards[1].find('.v-card-subtitle').text()).toBe('Sem ligas')
    expect(cards[1].attributes('href')).toBe('/admin/selecionar/3')
  })

  it('card com imagem mostra a imagem inteira; sem imagem mostra o troféu', async () => {
    login('master')
    const withImage = { ...championshipA, image: 'http://api/copa.png' }
    listLeagues.mockResolvedValue([makeLeague(1, withImage)])
    listChampionships.mockResolvedValue([withImage, championshipC])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    const cards = wrapper.findAll('[data-test="championship-card"]')
    const image = cards[0].findComponent({ name: 'ChampionshipImage' })
    expect(image.props()).toMatchObject({ src: 'http://api/copa.png', height: '140' })
    expect(image.find('[data-test="championship-image-front"]').exists()).toBe(true)
    expect(cards[1].find('.v-img').exists()).toBe(false)
    expect(cards[1].find('.mdi-trophy-outline').exists()).toBe(true)
  })

  it('usuário sem liga vinculada vê mensagem clara em vez de erro', async () => {
    login('coach')
    listLeagues.mockResolvedValue([])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    expect(wrapper.find('[data-test="empty-state"]').text()).toContain(
      'Nenhuma liga está vinculada ao seu usuário',
    )
  })

  it('avisa quando chegou aqui por tentar abrir uma liga sem acesso (sem pular, mesmo com liga única)', async () => {
    login('admin')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar?negado=1')

    expect(wrapper.find('[data-test="access-denied"]').exists()).toBe(true)
    expect(wrapper.router.currentRoute.value.name).toBe('admin-select-championship')
  })

  it.each(['coach', 'player', 'admin'])('%s com uma única liga entra direto nela', async (role) => {
    login(role)
    listLeagues.mockResolvedValue([makeLeague(4, championshipA)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    await vi.waitFor(() => expect(wrapper.router.currentRoute.value.fullPath).toBe('/admin/liga/4'))
  })

  it('master com uma única liga continua na seleção (acesso à gestão de campeonatos)', async () => {
    login('master')
    listLeagues.mockResolvedValue([makeLeague(4, championshipA)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    expect(wrapper.router.currentRoute.value.name).toBe('admin-select-championship')
    expect(wrapper.findAll('[data-test="championship-card"]')).toHaveLength(1)
  })

  it('com mais de uma liga (mesmo num só campeonato) não pula a seleção', async () => {
    login('coach')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA), makeLeague(3, championshipA)])

    const wrapper = await mountView(ChampionshipSelectView, '/admin/selecionar')

    expect(wrapper.router.currentRoute.value.name).toBe('admin-select-championship')
  })
})

describe('Seleção de Liga', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    listLeagues.mockReset()
    listChampionships.mockReset()
    listChampionships.mockResolvedValue([])
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

  it('campeonato com uma única liga entra direto nela', async () => {
    listLeagues.mockResolvedValue([
      makeLeague(1, championshipA, { name: 'Série A' }),
      makeLeague(2, championshipB, { name: 'Copa SP' }),
    ])

    const wrapper = await mountView(LeagueSelectView, '/admin/selecionar/2', {
      championshipId: '2',
    })

    await vi.waitFor(() => expect(wrapper.router.currentRoute.value.fullPath).toBe('/admin/liga/2'))
  })

  it('campeonato sem ligas acessíveis mostra estado vazio', async () => {
    listLeagues.mockResolvedValue([makeLeague(2, championshipB)])

    const wrapper = await mountView(LeagueSelectView, '/admin/selecionar/1', { championshipId: '1' })

    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('master num campeonato sem ligas vê a mensagem e o atalho para gerenciá-lo', async () => {
    login('master')
    listLeagues.mockResolvedValue([makeLeague(1, championshipA)])
    listChampionships.mockResolvedValue([championshipA, championshipC])

    const wrapper = await mountView(LeagueSelectView, '/admin/selecionar/3', {
      championshipId: '3',
    })

    expect(wrapper.find('[data-test="no-leagues"]').text()).toContain(
      'Sem ligas para esse campeonato.',
    )
    expect(wrapper.findAll('[data-test="league-card"]')).toHaveLength(0)
    const manage = wrapper.find('[data-test="manage-championship"]')
    expect(manage.text()).toBe('Gerenciar campeonato')
    expect(manage.attributes('href')).toBe('/admin/campeonatos/3/editar')
    expect(wrapper.router.currentRoute.value.name).toBe('admin-select-league')
  })

  it('quem não é master não busca campeonatos sem liga e segue com o estado vazio de antes', async () => {
    listLeagues.mockResolvedValue([makeLeague(1, championshipA)])

    const wrapper = await mountView(LeagueSelectView, '/admin/selecionar/3', {
      championshipId: '3',
    })

    expect(listChampionships).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="no-leagues"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="manage-championship"]').exists()).toBe(false)
  })
})
