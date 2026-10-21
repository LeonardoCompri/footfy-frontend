import { describe, expect, it, vi } from 'vitest'
import { useCrud } from '@/composables/useCrud'
import type { Paginated } from '@/types/api'
import type { Game, GamePayload } from '@/types/game'
import { apiError, makeGame, makePage } from '@/test/factories'

function makeService() {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listPaginated: vi.fn(),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => (resolve = res))
  return { promise, resolve }
}

describe('useCrud', () => {
  it('fetchPage preenche items e meta', async () => {
    const service = makeService()
    service.listPaginated.mockResolvedValue(
      makePage([makeGame(1), makeGame(2)], { total: 22, last_page: 2 }),
    )
    const crud = useCrud<Game, GamePayload>(service)

    const ok = await crud.fetchPage({ league_id: 7, page: 1 })

    expect(ok).toBe(true)
    expect(service.listPaginated).toHaveBeenCalledWith({ league_id: 7, page: 1 })
    expect(crud.items.value.map((game) => game.id)).toEqual([1, 2])
    expect(crud.meta.value).toEqual({ current_page: 1, per_page: 20, total: 22, last_page: 2 })
    expect(crud.loading.value).toBe(false)
  })

  it('resposta antiga não sobrescreve a mais recente', async () => {
    const service = makeService()
    const slow = deferred<Paginated<Game>>()
    const fast = deferred<Paginated<Game>>()
    service.listPaginated.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)
    const crud = useCrud<Game, GamePayload>(service)

    const first = crud.fetchPage({ page: 1 })
    const second = crud.fetchPage({ page: 2 })
    fast.resolve(makePage([makeGame(2)], { current_page: 2 }))
    await second
    slow.resolve(makePage([makeGame(1)], { current_page: 1 }))
    await first

    expect(crud.items.value.map((game) => game.id)).toEqual([2])
    expect(crud.meta.value?.current_page).toBe(2)
    expect(crud.loading.value).toBe(false)
  })

  it('erro vai para errorMessage', async () => {
    const service = makeService()
    service.listPaginated.mockRejectedValue(apiError(422, 'Liga inválida.'))
    const crud = useCrud<Game, GamePayload>(service)

    const ok = await crud.fetchPage({ league_id: 99 })

    expect(ok).toBe(false)
    expect(crud.errorMessage.value).toBe('Liga inválida.')
    expect(crud.loading.value).toBe(false)
  })

  it('fetchPage exige um service com listPaginated', async () => {
    const crud = useCrud<Game, GamePayload>({ ...makeService(), listPaginated: undefined })

    await expect(crud.fetchPage({})).rejects.toThrow('listPaginated')
  })

  it('fetchAll continua usando list sem meta', async () => {
    const service = makeService()
    service.list.mockResolvedValue([makeGame(1)])
    const crud = useCrud<Game, GamePayload>(service)

    await crud.fetchAll({ league_id: 7 })

    expect(service.list).toHaveBeenCalledWith({ league_id: 7 })
    expect(service.listPaginated).not.toHaveBeenCalled()
    expect(crud.items.value.map((game) => game.id)).toEqual([1])
    expect(crud.meta.value).toBeNull()
  })
})
