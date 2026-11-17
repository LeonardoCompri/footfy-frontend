import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChampionshipListView from '@/views/public/championships/ChampionshipListView.vue'
import { publicChampionshipsService } from '@/services/api/publicChampionships.service'
import { createTestRouter, createTestVuetify } from '@/test/utils'
import { makePage } from '@/test/factories'
import type { Championship } from '@/types/championship'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/publicChampionships.service', () => ({
  publicChampionshipsService: { list: vi.fn(), listPaginated: vi.fn(), get: vi.fn() },
}))

const championship = (id: number, name: string): Championship => ({ id, name, image: null })

async function mountView() {
  const router = createTestRouter()
  await router.push('/campeonatos')
  const wrapper = mount(ChampionshipListView, {
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return wrapper
}

function names(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper.findAll('.v-card-title').map((title) => title.text())
}

const loadMoreButton = '[data-test=championships-load-more]'

async function typeSearch(wrapper: Awaited<ReturnType<typeof mountView>>, value: string) {
  await wrapper.find('[data-test=championships-search] input').setValue(value)
  vi.advanceTimersByTime(400)
  await flushPromises()
}

describe('ChampionshipListView público', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carrega a 1ª página e "Carregar mais" pede a página 2 e acumula', async () => {
    vi.mocked(publicChampionshipsService.listPaginated)
      .mockResolvedValueOnce(
        makePage([championship(1, 'Copa Footfy'), championship(2, 'Torneio de Verão')], {
          per_page: 12,
          total: 3,
          last_page: 2,
        }),
      )
      .mockResolvedValueOnce(
        makePage([championship(3, 'Liga da Serra')], {
          current_page: 2,
          per_page: 12,
          total: 3,
          last_page: 2,
        }),
      )
    const wrapper = await mountView()

    expect(publicChampionshipsService.listPaginated).toHaveBeenCalledWith({ page: 1, per_page: 12 })
    expect(names(wrapper)).toEqual(['Copa Footfy', 'Torneio de Verão'])

    await wrapper.find(loadMoreButton).trigger('click')
    await flushPromises()

    expect(publicChampionshipsService.listPaginated).toHaveBeenLastCalledWith({
      page: 2,
      per_page: 12,
    })
    expect(names(wrapper)).toEqual(['Copa Footfy', 'Torneio de Verão', 'Liga da Serra'])
    expect(wrapper.find(loadMoreButton).exists()).toBe(false)
  })

  it('não mostra "Carregar mais" quando já está na última página', async () => {
    vi.mocked(publicChampionshipsService.listPaginated).mockResolvedValue(
      makePage([championship(1, 'Copa Footfy')], { per_page: 12 }),
    )
    const wrapper = await mountView()

    expect(wrapper.find(loadMoreButton).exists()).toBe(false)
  })

  it('a busca espera a digitação parar e reinicia a lista na página 1', async () => {
    vi.mocked(publicChampionshipsService.listPaginated)
      .mockResolvedValueOnce(
        makePage([championship(1, 'Copa Footfy')], { per_page: 12, total: 13, last_page: 2 }),
      )
      .mockResolvedValueOnce(
        makePage([championship(2, 'Torneio de Verão')], {
          current_page: 2,
          per_page: 12,
          total: 13,
          last_page: 2,
        }),
      )
      .mockResolvedValueOnce(makePage([championship(4, 'Copa do Interior')], { per_page: 12 }))
    const wrapper = await mountView()
    await wrapper.find(loadMoreButton).trigger('click')
    await flushPromises()

    await wrapper.find('[data-test=championships-search] input').setValue('co')
    vi.advanceTimersByTime(200)
    await typeSearch(wrapper, ' copa ')

    expect(publicChampionshipsService.listPaginated).toHaveBeenCalledTimes(3)
    expect(publicChampionshipsService.listPaginated).toHaveBeenLastCalledWith({
      search: 'copa',
      page: 1,
      per_page: 12,
    })
    expect(names(wrapper)).toEqual(['Copa do Interior'])
    expect(wrapper.find(loadMoreButton).exists()).toBe(false)
  })

  it('busca sem resultado mostra o aviso da busca', async () => {
    vi.mocked(publicChampionshipsService.listPaginated)
      .mockResolvedValueOnce(makePage([championship(1, 'Copa Footfy')], { per_page: 12 }))
      .mockResolvedValueOnce(makePage([], { per_page: 12 }))
    const wrapper = await mountView()

    await typeSearch(wrapper, 'xyz')

    expect(wrapper.find('[data-test=championships-empty]').text()).toBe(
      'Nenhum campeonato encontrado para essa busca.',
    )
  })

  it('a resposta de "Carregar mais" que chega depois de uma nova busca é descartada', async () => {
    let resolvePage2!: (page: ReturnType<typeof makePage<Championship>>) => void
    vi.mocked(publicChampionshipsService.listPaginated)
      .mockResolvedValueOnce(
        makePage([championship(1, 'Copa Footfy')], { per_page: 12, total: 13, last_page: 2 }),
      )
      .mockReturnValueOnce(new Promise((resolve) => (resolvePage2 = resolve)))
      .mockResolvedValueOnce(makePage([championship(4, 'Copa do Interior')], { per_page: 12 }))
    const wrapper = await mountView()

    await wrapper.find(loadMoreButton).trigger('click')
    await typeSearch(wrapper, 'interior')
    resolvePage2(
      makePage([championship(2, 'Torneio de Verão')], {
        current_page: 2,
        per_page: 12,
        total: 13,
        last_page: 2,
      }),
    )
    await flushPromises()

    expect(names(wrapper)).toEqual(['Copa do Interior'])
  })
})
