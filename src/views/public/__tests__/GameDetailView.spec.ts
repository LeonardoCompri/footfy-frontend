import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createWebHistory, type Router } from 'vue-router'
import GameDetailView from '@/views/public/games/GameDetailView.vue'
import { createTestRouter, createTestVuetify } from '@/test/utils'

async function mountDetail(path: string, router: Router = createTestRouter()) {
  await router.push(path)
  const wrapper = mount(GameDetailView, {
    props: { id: '1' },
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

function backButton(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  return wrapper.findAll('button').find((button) => button.text() === 'Voltar')!
}

describe('GameDetailView público', () => {
  it('Voltar sem histórico leva para a lista de campeonatos', async () => {
    const { wrapper, router } = await mountDetail('/partidas/1')

    await backButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('championships-list')
  })

  it('Voltar com histórico volta para a página anterior', async () => {
    const router = createTestRouter(createWebHistory())
    await router.push('/ligas/3')
    const { wrapper } = await mountDetail('/partidas/1', router)

    await backButton(wrapper).trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/ligas/3'))
  })
})
