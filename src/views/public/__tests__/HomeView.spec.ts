import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '@/views/public/HomeView.vue'
import ChampionshipCard from '@/components/championships/ChampionshipCard.vue'
import { publicChampionshipsService } from '@/services/api/publicChampionships.service'
import type { Championship } from '@/types/championship'
import { createTestRouter, createTestVuetify } from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/publicChampionships.service', () => ({
  publicChampionshipsService: { list: vi.fn(), get: vi.fn() },
}))

const EMPTY_TEXT = 'Nenhum campeonato cadastrado ainda'

function makeChampionships(count: number): Championship[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Campeonato ${index + 1}`,
    image: null,
  }))
}

async function mountHome() {
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mount(HomeView, { global: { plugins: [createTestVuetify(), router] } })
  await flushPromises()
  return wrapper
}

describe('HomeView - campeonatos em destaque', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o loading enquanto a lista carrega', async () => {
    vi.mocked(publicChampionshipsService.list).mockReturnValue(new Promise(() => {}))

    const wrapper = await mountHome()

    expect(publicChampionshipsService.list).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain(EMPTY_TEXT)
    expect(wrapper.findAllComponents(ChampionshipCard)).toHaveLength(0)
  })

  it('exibe no máximo 3 campeonatos', async () => {
    vi.mocked(publicChampionshipsService.list).mockResolvedValue(makeChampionships(5))

    const wrapper = await mountHome()

    const cards = wrapper.findAllComponents(ChampionshipCard)
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.props('championship').name)).toEqual([
      'Campeonato 1',
      'Campeonato 2',
      'Campeonato 3',
    ])
    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(false)
    expect(wrapper.text()).not.toContain(EMPTY_TEXT)
  })

  it('exibe o aviso de lista vazia quando não há campeonatos', async () => {
    vi.mocked(publicChampionshipsService.list).mockResolvedValue([])

    const wrapper = await mountHome()

    expect(wrapper.text()).toContain(EMPTY_TEXT)
    expect(wrapper.findAllComponents(ChampionshipCard)).toHaveLength(0)
    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(false)
  })

  it('trata falha da API como lista vazia, sem alerta de erro', async () => {
    vi.mocked(publicChampionshipsService.list).mockRejectedValue(apiError(500, 'Erro no servidor'))

    const wrapper = await mountHome()

    const alerts = wrapper.findAllComponents({ name: 'VAlert' })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].props('type')).toBe('info')
    expect(alerts[0].text()).toContain(EMPTY_TEXT)
    expect(wrapper.text()).not.toContain('Erro no servidor')
    expect(wrapper.findAllComponents(ChampionshipCard)).toHaveLength(0)
  })
})
