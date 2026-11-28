import { describe, expect, it, vi } from 'vitest'
import { extractErrorMessage, useCrud } from '@/composables/useCrud'
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

function withRequestId(status: number, message: string, requestId: string) {
  const err = apiError(status, message)
  return { response: { ...err.response, headers: { 'x-request-id': requestId } } }
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

  describe('extractErrorMessage', () => {
    it('erro 500 com x-request-id mostra o código do erro', () => {
      const err = withRequestId(500, 'Server Error', 'a1b2c3')

      expect(extractErrorMessage(err)).toBe('Server Error Código do erro: a1b2c3')
    })

    it('erro 500 sem o header mantém a mensagem', () => {
      expect(extractErrorMessage(apiError(500, 'Server Error'))).toBe('Server Error')
    })

    it.each([422, 404])('erro %i com x-request-id mantém a mensagem', (status) => {
      expect(extractErrorMessage(withRequestId(status, 'Falhou.', 'a1b2c3'))).toBe('Falhou.')
    })

    it('erro 500 sem mensagem usa a genérica com o código', () => {
      const err = { response: { status: 500, data: {}, headers: { 'x-request-id': 'a1b2c3' } } }

      expect(extractErrorMessage(err)).toBe('Ocorreu um erro inesperado. Código do erro: a1b2c3')
    })
  })

  it('save com erro 500 leva o código do erro ao errorMessage', async () => {
    const service = makeService()
    service.create.mockRejectedValue(withRequestId(500, 'Server Error', 'a1b2c3'))
    const crud = useCrud<Game, GamePayload>(service)

    await crud.save({} as GamePayload)

    expect(crud.errorMessage.value).toBe('Server Error Código do erro: a1b2c3')
  })
})
