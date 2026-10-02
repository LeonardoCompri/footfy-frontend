import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { championshipA, createTestVuetify, makeLeague, makeUser } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), dashboard: vi.fn() },
}))

const Stub = { render: () => null }

function createLayoutRouter() {
  const leagueChild = (path: string, name: string) => ({ path, name, component: Stub })
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Stub },
      {
        path: '/admin',
        component: AdminLayout,
        children: [
          { path: 'selecionar', name: 'admin-select-championship', component: Stub },
          {
            path: 'liga/:leagueId',
            meta: { requiresLeague: true },
            children: [
              leagueChild('', 'admin-dashboard'),
              leagueChild('times', 'admin-teams-list'),
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

async function mountAt(path: string, role = 'admin', permissions: string[] = ['game:read']) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser(role, permissions)
  const context = useLeagueContextStore()
  context.leagues = [makeLeague(1, championshipA, { name: 'Série A' })]
  context.loaded = true
  context.setActiveLeague(1)

  const router = createLayoutRouter()
  await router.push(path)
  const wrapper = mount({ template: '<RouterView />' }, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('AdminLayout — nav rail e pill de contexto', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    window.innerWidth = 1366
  })

  it('no desktop o menu lateral fica aberto dentro de uma liga, na ordem do card', async () => {
    const wrapper = await mountAt('/admin/liga/1')

    const drawer = wrapper.find('.v-navigation-drawer')
    expect(drawer.classes()).toContain('v-navigation-drawer--active')
    expect(drawer.findAll('.v-list-item-title').map((t) => t.text())).toEqual([
      'Footfy',
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

  it('fora de uma liga (seleção) não mostra menu nem pill', async () => {
    const wrapper = await mountAt('/admin/selecionar')
    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Trocar')
    expect(wrapper.text()).toContain('Footfy Admin')
  })
})
