import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEventTypesStore } from '@/stores/eventTypes'
import { eventTypesService } from '@/services/api/eventTypes.service'
import { apiError, defaultEventTypes, makeEventType } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/eventTypes.service', () => ({ eventTypesService: { list: vi.fn() } }))

describe('eventTypes store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(eventTypesService.list).mockReset()
    vi.mocked(eventTypesService.list).mockResolvedValue(defaultEventTypes())
  })

  it('carrega uma vez só e não grava no localStorage', async () => {
    const store = useEventTypesStore()
    await store.load()
    await store.load()

    expect(eventTypesService.list).toHaveBeenCalledTimes(1)
    expect(store.loaded).toBe(true)
    expect(store.types.map((type) => type.slug)).toEqual([
      'goal',
      'own_goal',
      'yellow_card',
      'red_card',
    ])
    expect(localStorage.length).toBe(0)
  })

  it('chamadas simultâneas compartilham a mesma requisição', async () => {
    let resolve!: (value: ReturnType<typeof defaultEventTypes>) => void
    vi.mocked(eventTypesService.list).mockReturnValue(new Promise((r) => (resolve = r)))
    const store = useEventTypesStore()

    const first = store.load()
    const second = store.load()
    expect(store.loading).toBe(true)
    resolve(defaultEventTypes())
    await Promise.all([first, second])

    expect(eventTypesService.list).toHaveBeenCalledTimes(1)
    expect(store.loading).toBe(false)
    expect(store.active).toHaveLength(4)
  })

  it('depois de um erro guarda a mensagem e a próxima chamada tenta de novo', async () => {
    vi.mocked(eventTypesService.list).mockRejectedValueOnce(apiError(500, 'Erro no servidor'))
    const store = useEventTypesStore()

    await expect(store.load()).rejects.toBeTruthy()
    expect(store.loaded).toBe(false)
    expect(store.errorMessage).toBe('Erro no servidor')

    await store.load()
    expect(eventTypesService.list).toHaveBeenCalledTimes(2)
    expect(store.loaded).toBe(true)
    expect(store.errorMessage).toBeNull()
  })

  it('`active` traz só os ativos, ordenados por sort_order e id', async () => {
    vi.mocked(eventTypesService.list).mockResolvedValue([
      makeEventType(5, 'penalty_goal', { sort_order: 2 }),
      makeEventType(3, 'old', { sort_order: 1, active: false }),
      makeEventType(4, 'b', { sort_order: 1 }),
      makeEventType(2, 'a', { sort_order: 1 }),
    ])
    const store = useEventTypesStore()
    await store.load()

    expect(store.active.map((type) => type.slug)).toEqual(['a', 'b', 'penalty_goal'])
    expect(store.bySlug('old').id).toBe(3)
  })

  it('tipo desconhecido usa o fallback: nome = slug, ícone de ajuda, cinza, sem flags', async () => {
    const store = useEventTypesStore()
    await store.load()

    expect(store.bySlug('penalty_goal')).toMatchObject({
      slug: 'penalty_goal',
      name: 'penalty_goal',
      icon: 'mdi-help-circle-outline',
      color: 'grey',
      counts_for: null,
      allows_assist: false,
      card: null,
    })
  })

  it('cor fora da lista vira primary; ícone vazio ou sem `mdi-` vira o ícone de ajuda', async () => {
    vi.mocked(eventTypesService.list).mockResolvedValue([
      makeEventType(1, 'a', { color: '#ff0000', icon: 'mdi-whistle' }),
      makeEventType(2, 'b', { color: 'card-red', icon: '' }),
      makeEventType(3, 'c', { color: 'grey', icon: 'soccer' }),
    ])
    const store = useEventTypesStore()
    await store.load()

    expect(store.types.map(({ color, icon }) => [color, icon])).toEqual([
      ['primary', 'mdi-whistle'],
      ['card-red', 'mdi-help-circle-outline'],
      ['grey', 'mdi-help-circle-outline'],
    ])
  })
})
