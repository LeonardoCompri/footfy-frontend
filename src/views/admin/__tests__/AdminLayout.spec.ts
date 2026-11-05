import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { useAppTheme } from '@/composables/useAppTheme'
import { championshipA, createTestVuetify, makeLeague, makeUser } from '@/test/utils'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), dashboard: vi.fn() },
}))
vi.mock('@/services/api/auth.service', () => ({
  authService: { logout: vi.fn().mockResolvedValue({}) },
}))

const Stub = { render: () => null }
// Conta as montagens da tela de detalhe do time (remonta ao trocar de time?).
const teamDetailMounts = vi.fn()
const TeamDetailStub = { render: () => null, mounted: teamDetailMounts }

// O v-menu da conta (VOverlay com close-on-back) registra um beforeEach que adia toda navegação
// por um setTimeout: depois de um clique em link, espere a rota com vi.waitFor.
function createLayoutRouter() {
  const leagueChild = (path: string, name: string, component: object = Stub) => ({
    path,
    name,
    component,
  })
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Stub },
      {
        path: '/admin',
        component: AdminLayout,
        children: [
          {
            path: '',
            name: 'admin-home',
            redirect: () => {
              const { activeLeagueId } = useLeagueContextStore()
              return activeLeagueId
                ? { name: 'admin-dashboard', params: { leagueId: activeLeagueId } }
                : { name: 'admin-select-championship' }
            },
          },
          { path: 'selecionar', name: 'admin-select-championship', component: Stub },
          { path: 'perfil', name: 'admin-profile', component: Stub },
          {
            path: 'liga/:leagueId',
            meta: { requiresLeague: true },
            children: [
              leagueChild('', 'admin-dashboard'),
              leagueChild('times', 'admin-teams-list'),
              leagueChild('times/:teamId', 'admin-teams-detail', TeamDetailStub),
              leagueChild('times/:teamId/jogadores/:id', 'admin-players-detail'),
              leagueChild('estadios', 'admin-stadiums-list'),
              leagueChild('partidas', 'admin-games-list'),
              leagueChild('partidas/:id', 'admin-games-detail'),
              leagueChild('tabela', 'admin-league-table'),
              leagueChild('estatisticas', 'admin-league-statistics'),
              leagueChild('usuarios', 'admin-users-list'),
            ],
          },
        ],
      },
    ],
  })
}

async function mountAt(
  path: string,
  role = 'admin',
  permissions: string[] = ['game:read'],
  extra: Partial<AuthUser> = {},
) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser(role, permissions, extra)
  const context = useLeagueContextStore()
  context.leagues = [makeLeague(1, championshipA, { name: 'Série A' })]
  context.loaded = true
  context.setActiveLeague(1)
  return mountLayout(path)
}

// Monta o layout sem preparar o contexto de liga (o teste define o estado antes).
async function mountLayout(path: string) {
  const router = createLayoutRouter()
  await router.push(path)
  const wrapper = mount({ template: '<RouterView />' }, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return Object.assign(wrapper, { router })
}

const myTeam = { team: { id: 5, name: 'Vitória FC', logo: null } }

function navTitles(wrapper: VueWrapper) {
  return wrapper.findAll('.v-navigation-drawer .v-list-item-title').map((t) => t.text())
}

async function openAccountMenu(wrapper: VueWrapper) {
  await wrapper.find('[data-test="account-menu"]').trigger('click')
  await flushPromises()
}

function activeItems(wrapper: VueWrapper) {
  return wrapper.findAll('.v-navigation-drawer .v-list-item--active').map((i) => i.text())
}

describe('AdminLayout — nav rail e pill de contexto', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    window.innerWidth = 1366
    // O tema é um ref de módulo: volta ao claro para não vazar entre os testes.
    useAppTheme().themeName.value = 'footfyLight'
  })

  it('no desktop o menu lateral fica aberto dentro de uma liga, na ordem do card', async () => {
    const wrapper = await mountAt('/admin/liga/1')

    const drawer = wrapper.find('.v-navigation-drawer')
    expect(drawer.classes()).toContain('v-navigation-drawer--active')
    expect(drawer.findAll('.v-list-item-title').map((t) => t.text())).toEqual([
      'Dashboard',
      'Times',
      'Estádios',
      'Partidas',
      'Tabela',
      'Estatísticas',
      'Usuários',
      'Recolher',
    ])
    expect(wrapper.text()).toContain('Série A')
    expect(wrapper.text()).toContain('Trocar')
  })

  it('esconde Usuários para quem não é master/admin', async () => {
    const wrapper = await mountAt('/admin/liga/1', 'coach')
    const titles = wrapper.findAll('.v-navigation-drawer .v-list-item-title').map((t) => t.text())
    expect(titles).not.toContain('Usuários')
  })

  it('esconde Partidas para quem não tem game:read (ex.: coach do seeder)', async () => {
    const wrapper = await mountAt('/admin/liga/1', 'coach', ['team:read', 'stadium:read', 'player:read'])
    const titles = wrapper.findAll('.v-navigation-drawer .v-list-item-title').map((t) => t.text())
    expect(titles).not.toContain('Partidas')
    expect(titles).toContain('Tabela')
  })

  it('mantém "Partidas" destacado no detalhe da partida', async () => {
    const wrapper = await mountAt('/admin/liga/1/partidas/3')
    const active = wrapper.findAll('.v-navigation-drawer .v-list-item--active').map((i) => i.text())
    expect(active).toEqual(['Partidas'])
  })

  it('mantém "Times" destacado nas telas internas de time/jogador/comissão', async () => {
    const wrapper = await mountAt('/admin/liga/1/times/5/jogadores/10')
    const active = wrapper.findAll('.v-navigation-drawer .v-list-item--active').map((i) => i.text())
    expect(active).toEqual(['Times'])
  })

  it('coach com time vê "Meu time" logo após o Dashboard, apontando para o detalhe do time dele', async () => {
    const wrapper = await mountAt('/admin/liga/1', 'coach', ['team:read'], myTeam)

    expect(navTitles(wrapper).slice(0, 3)).toEqual(['Dashboard', 'Meu time', 'Times'])
    const item = wrapper
      .findAll('.v-navigation-drawer .v-list-item')
      .find((i) => i.text() === 'Meu time')
    expect(item?.attributes('href')).toBe('/admin/liga/1/times/5')
  })

  it.each([
    ['coach sem time vinculado', 'coach', {}],
    ['admin', 'admin', {}],
    ['player com time (do jogador vinculado)', 'player', myTeam],
  ])('"Meu time" não aparece para %s', async (_label, role, extra) => {
    const wrapper = await mountAt('/admin/liga/1', role, ['team:read'], extra)
    expect(navTitles(wrapper)).not.toContain('Meu time')
    expect(navTitles(wrapper)).toContain('Times')
  })

  it('coach: telas do próprio time destacam "Meu time"; as de outro time, "Times"', async () => {
    const wrapper = await mountAt(
      '/admin/liga/1/times/5/jogadores/10',
      'coach',
      ['team:read'],
      myTeam,
    )
    expect(activeItems(wrapper)).toEqual(['Meu time'])

    await wrapper.router.push('/admin/liga/1/times/7')
    await flushPromises()
    expect(activeItems(wrapper)).toEqual(['Times'])
  })

  it('ir de um detalhe de time para outro ("Meu time") remonta a tela', async () => {
    teamDetailMounts.mockClear()
    const wrapper = await mountAt('/admin/liga/1/times/7', 'coach', ['team:read'], myTeam)
    expect(teamDetailMounts).toHaveBeenCalledTimes(1)

    const item = wrapper
      .findAll('.v-navigation-drawer .v-list-item')
      .find((i) => i.text() === 'Meu time')
    await item!.trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.router.currentRoute.value.fullPath).toBe('/admin/liga/1/times/5'),
    )
    await flushPromises()
    expect(teamDetailMounts).toHaveBeenCalledTimes(2)
  })

  it('fora de uma liga (seleção) não mostra menu nem pill', async () => {
    const wrapper = await mountAt('/admin/selecionar')
    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Trocar')
    const home = wrapper.find('[data-test="home-link"]')
    expect(home.find('img[alt="Futy"]').attributes('src')).toContain('futy-verde-classico')
    expect(home.text()).toBe('Admin')
  })

  it.each([
    ['dentro de uma liga', '/admin/liga/1'],
    ['fora de uma liga', '/admin/selecionar'],
  ])('menu da conta tem "Meu perfil" %s', async (_label, path) => {
    const wrapper = await mountAt(path, 'player', [])

    await openAccountMenu(wrapper)

    const link = document.querySelector('[data-test="profile-link"]')
    expect(link?.textContent).toContain('Meu perfil')
    expect(link?.getAttribute('href')).toBe('/admin/perfil')
    ;(link as HTMLElement).click()
    await vi.waitFor(() => expect(wrapper.router.currentRoute.value.name).toBe('admin-profile'))
  })

  it('no perfil com liga ativa mostra o menu e o pill da liga ativa, sem item destacado', async () => {
    const wrapper = await mountAt('/admin/perfil', 'coach', ['team:read'], myTeam)

    expect(wrapper.find('.v-navigation-drawer').classes()).toContain('v-navigation-drawer--active')
    expect(activeItems(wrapper)).toEqual([])
    expect(wrapper.text()).toContain('Série A')
    expect(wrapper.find('[data-test="home-link"]').exists()).toBe(false)
    const hrefs = wrapper
      .findAll('.v-navigation-drawer .v-list-item[href]')
      .map((i) => [i.text(), i.attributes('href')])
    expect(hrefs).toContainEqual(['Dashboard', '/admin/liga/1'])
    expect(hrefs).toContainEqual(['Meu time', '/admin/liga/1/times/5'])

    const dashboard = wrapper
      .findAll('.v-navigation-drawer .v-list-item')
      .find((i) => i.text() === 'Dashboard')
    await dashboard!.trigger('click')
    await vi.waitFor(() => expect(wrapper.router.currentRoute.value.name).toBe('admin-dashboard'))
  })

  it('no perfil com liga ativa o mobile tem o hambúrguer que abre o menu', async () => {
    window.innerWidth = 375
    const wrapper = await mountAt('/admin/perfil')

    const navIcon = wrapper.find('.v-app-bar-nav-icon')
    expect(navIcon.exists()).toBe(true)
    await navIcon.trigger('click')
    await flushPromises()
    expect(wrapper.find('.v-navigation-drawer').classes()).toContain('v-navigation-drawer--active')
  })

  it('reload direto no perfil busca as ligas para montar o menu da liga ativa', async () => {
    const { leaguesService } = await import('@/services/api/leagues.service')
    vi.mocked(leaguesService.list).mockReset()
    vi.mocked(leaguesService.list).mockResolvedValue([
      makeLeague(1, championshipA, { name: 'Série A' }),
    ])
    useAuthStore().token = 'token'
    useAuthStore().user = makeUser('admin', ['game:read'])
    useLeagueContextStore().setActiveLeague(1)

    const wrapper = await mountLayout('/admin/perfil')

    expect(leaguesService.list).toHaveBeenCalledTimes(1)
    expect(navTitles(wrapper)).toContain('Dashboard')
    expect(wrapper.text()).toContain('Série A')
  })

  it('no perfil sem liga ativa não mostra o menu e a marca leva ao painel', async () => {
    useAuthStore().token = 'token'
    useAuthStore().user = makeUser('admin', ['game:read'])

    const wrapper = await mountLayout('/admin/perfil')

    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    const home = wrapper.find('[data-test="home-link"]')
    expect(home.find('img[alt="Futy"]').exists()).toBe(true)
    expect(home.text()).toBe('Admin')
    expect(home.attributes('href')).toBe('/admin')
    await home.trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.router.currentRoute.value.name).toBe('admin-select-championship'),
    )
  })

  it('"Meu perfil" não entra no menu lateral da liga', async () => {
    const wrapper = await mountAt('/admin/liga/1')
    expect(navTitles(wrapper)).not.toContain('Meu perfil')
  })

  it('"Sair" no menu da conta encerra a sessão e volta para o login', async () => {
    const wrapper = await mountAt('/admin/liga/1')

    await openAccountMenu(wrapper)
    ;(document.querySelector('[data-test="logout"]') as HTMLElement).click()

    await vi.waitFor(() => expect(wrapper.router.currentRoute.value.name).toBe('login'))
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  describe('marca no menu lateral', () => {
    function brand(wrapper: VueWrapper) {
      const block = wrapper.find('[data-test="drawer-brand"]')
      const img = block.find('img')
      return { src: img.attributes('src'), alt: img.attributes('alt'), text: block.text() }
    }

    it('mostra o logo do tema claro com "Painel Administrativo" embaixo', async () => {
      const wrapper = await mountAt('/admin/liga/1')
      const { src, alt, text } = brand(wrapper)
      expect(src).toContain('futy-verde-classico')
      expect(alt).toBe('Futy')
      expect(text).toBe('Painel Administrativo')
    })

    it('no tema escuro usa a versão noite do logo', async () => {
      useAppTheme().themeName.value = 'footfyDark'
      const wrapper = await mountAt('/admin/liga/1')
      expect(brand(wrapper).src).toContain('futy-verde-noite')
    })

    it('no tema escuro o app bar fora da liga também usa a versão noite', async () => {
      useAppTheme().themeName.value = 'footfyDark'
      const wrapper = await mountAt('/admin/selecionar')
      expect(wrapper.find('[data-test="home-link"] img').attributes('src')).toContain(
        'futy-verde-noite',
      )
    })

    it.each([
      ['claro', 'footfyLight', 'futy-simbolo.svg'],
      ['escuro', 'footfyDark', 'futy-simbolo-noite.svg'],
    ] as const)('recolhido no desktop (%s) mostra só o símbolo', async (_label, theme, file) => {
      useAppTheme().themeName.value = theme
      const wrapper = await mountAt('/admin/liga/1')

      const collapse = wrapper
        .findAll('.v-navigation-drawer .v-list-item')
        .find((i) => i.text() === 'Recolher')
      await collapse!.trigger('click')

      expect(wrapper.find('.v-navigation-drawer').classes()).toContain('v-navigation-drawer--rail')
      const { src, alt, text } = brand(wrapper)
      expect(src).toContain(file)
      expect(alt).toBe('Futy')
      expect(text).toBe('')
    })

    it('no mobile o menu aberto mostra o logo inteiro', async () => {
      window.innerWidth = 375
      const wrapper = await mountAt('/admin/liga/1')

      await wrapper.find('.v-app-bar-nav-icon').trigger('click')
      await flushPromises()

      expect(wrapper.find('.v-navigation-drawer').classes()).not.toContain(
        'v-navigation-drawer--rail',
      )
      const { src, text } = brand(wrapper)
      expect(src).toContain('futy-verde-classico')
      expect(text).toBe('Painel Administrativo')
    })
  })
})
