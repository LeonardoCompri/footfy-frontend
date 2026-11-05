import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { publicRoutes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { createTestVuetify, makeUser } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))

const Stub = { render: () => null }

// Rotas públicas reais (com a home como filha de path vazio do layout, que é o caso do BUG-036)
// e componentes trocados por stub.
function createPublicRouter() {
  const routes = publicRoutes.map(
    (layout) =>
      ({
        ...layout,
        component: Stub,
        children: layout.children?.map((child) => ({ ...child, component: Stub })),
      }) as RouteRecordRaw,
  )
  return createRouter({
    history: createMemoryHistory(),
    routes: [...routes, { path: '/admin', name: 'admin-home', component: Stub }],
  })
}

// O useDisplay lê a largura quando o Vuetify é criado: defina innerWidth antes do mount.
async function mountLayout(width: number, authenticated = false, path = '/') {
  window.innerWidth = width
  if (authenticated) {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = makeUser('admin')
  }
  const router = createPublicRouter()
  await router.push(path)
  const wrapper = mount(PublicLayout, { global: { plugins: [createTestVuetify(), router] } })
  await flushPromises()
  return wrapper
}

function appBarLinks(wrapper: Awaited<ReturnType<typeof mountLayout>>) {
  return wrapper
    .findAll('.v-app-bar a.v-btn')
    .map((link) => [link.text() || link.attributes('aria-label'), link.attributes('href')])
}

// Rótulo (texto ou aria-label) dos botões marcados como ativos, pela classe e pelo aria-current.
function activeLinks(wrapper: Awaited<ReturnType<typeof mountLayout>>) {
  const label = (link: ReturnType<typeof wrapper.find>) =>
    link.text() || link.attributes('aria-label')
  return {
    active: wrapper.findAll('.v-app-bar a.v-btn.v-btn--active').map(label),
    current: wrapper.findAll('.v-app-bar a.v-btn[aria-current="page"]').map(label),
  }
}

describe('PublicLayout — app bar', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    window.innerWidth = 1366
  })

  it('no desktop mostra Início, Campeonatos e Entrar com texto', async () => {
    const wrapper = await mountLayout(1366)

    expect(appBarLinks(wrapper)).toEqual([
      ['Início', '/'],
      ['Campeonatos', '/campeonatos'],
      ['Entrar', '/login'],
    ])
  })

  it('no desktop logado mostra "Painel Admin"', async () => {
    const wrapper = await mountLayout(1366, true)

    expect(appBarLinks(wrapper).at(-1)).toEqual(['Painel Admin', '/admin'])
  })

  // BUG-013: em 390px os três botões com texto estouravam a largura do app bar.
  it('no xs esconde Início, Campeonatos vira ícone e Entrar mantém o texto', async () => {
    const wrapper = await mountLayout(375)

    expect(appBarLinks(wrapper)).toEqual([
      ['Campeonatos', '/campeonatos'],
      ['Entrar', '/login'],
    ])
    const trophy = wrapper.find('.v-app-bar a[aria-label="Campeonatos"]')
    expect(trophy.text()).toBe('')
    expect(trophy.find('.mdi-trophy').exists()).toBe(true)
  })

  it('no xs logado o botão do painel fica só "Painel"', async () => {
    const wrapper = await mountLayout(375, true)

    expect(appBarLinks(wrapper)).toEqual([
      ['Campeonatos', '/campeonatos'],
      ['Painel', '/admin'],
    ])
  })

  // BUG-036: a home é filha de path vazio do layout e "Início" ficava ativo em toda tela pública.
  // No xs "Início" não existe (o logo leva à home) e "Campeonatos" é o ícone.
  const ACTIVE_BY_ROUTE = [
    { path: '/', desktop: ['Início'], xs: [] },
    { path: '/campeonatos', desktop: ['Campeonatos'], xs: ['Campeonatos'] },
    { path: '/campeonatos/1', desktop: ['Campeonatos'], xs: ['Campeonatos'] },
    { path: '/ligas/1', desktop: ['Campeonatos'], xs: ['Campeonatos'] },
    { path: '/times/1', desktop: ['Campeonatos'], xs: ['Campeonatos'] },
    { path: '/partidas/1', desktop: ['Campeonatos'], xs: ['Campeonatos'] },
    { path: '/login', desktop: ['Entrar'], xs: ['Entrar'] },
  ]

  describe.each([
    { screen: 'desktop', width: 1366 },
    { screen: 'xs', width: 375 },
  ] as const)('botão ativo no $screen', ({ screen, width }) => {
    it.each(ACTIVE_BY_ROUTE)('$path', async (route) => {
      const wrapper = await mountLayout(width, false, route.path)

      expect(activeLinks(wrapper)).toEqual({ active: route[screen], current: route[screen] })
    })
  })

  it('mostra a marca Futy no app bar (levando à home) e no rodapé', async () => {
    const wrapper = await mountLayout(1366)

    const home = wrapper.find('.v-app-bar a[href="/"] img')
    expect(home.attributes('alt')).toBe('Futy')
    expect(home.attributes('src')).toContain('futy-mono-branco')
    const footer = wrapper.find('.v-footer')
    expect(footer.find('img[alt="Futy"]').exists()).toBe(true)
    expect(footer.text()).toContain(
      `© ${new Date().getFullYear()} Futy — Gestão de campeonatos de futebol`,
    )
  })
})
