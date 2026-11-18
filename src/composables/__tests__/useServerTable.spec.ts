import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { SEARCH_DEBOUNCE_MS, useServerTable } from '@/composables/useServerTable'

function setup() {
  const load = vi.fn()
  const scope = effectScope()
  const table = scope.run(() => useServerTable<'name' | 'email'>(load))!
  return { load, scope, table }
}

describe('useServerTable', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carrega a página 1 com 20 por página ao iniciar', () => {
    const { load } = setup()

    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith({ page: 1, per_page: 20 })
  })

  it('busca só depois do debounce, com o termo sem espaços, e volta para a página 1', async () => {
    const { load, table } = setup()
    table.page.value = 3
    await nextTick()

    table.search.value = 'an'
    await nextTick()
    table.search.value = ' ana '
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    await nextTick()
    expect(load).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(load).toHaveBeenCalledTimes(3)
    expect(load).toHaveBeenLastCalledWith({ page: 1, per_page: 20, search: 'ana' })
  })

  it('termo igual ao aplicado não busca de novo nem muda a página', async () => {
    const { load, table } = setup()
    table.search.value = 'ana'
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await nextTick()
    table.page.value = 2
    await nextTick()

    table.search.value = 'ana '
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await nextTick()

    expect(load).toHaveBeenCalledTimes(3)
    expect(table.page.value).toBe(2)
  })

  it('limpar a busca (null) volta a listar sem search', async () => {
    const { load, table } = setup()
    table.search.value = 'ana'
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await nextTick()

    table.search.value = null
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await nextTick()

    expect(load).toHaveBeenLastCalledWith({ page: 1, per_page: 20 })
  })

  it.each([
    ['asc', 'asc'],
    ['desc', 'desc'],
    [true, 'asc'],
  ] as const)('ordenação %s vira sort/order=%s', async (order, expected) => {
    const { load, table } = setup()

    table.sortBy.value = [{ key: 'email', order }]
    await nextTick()

    expect(load).toHaveBeenLastCalledWith({ page: 1, per_page: 20, sort: 'email', order: expected })
  })

  it('mesma ordenação num array novo não busca de novo', async () => {
    const { load, table } = setup()
    table.sortBy.value = [{ key: 'name', order: 'asc' }]
    await nextTick()
    table.sortBy.value = [{ key: 'name', order: 'asc' }]
    await nextTick()

    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reload repete a busca atual e o dispose cancela o debounce pendente', async () => {
    const { load, scope, table } = setup()
    table.reload()
    expect(load).toHaveBeenCalledTimes(2)

    table.search.value = 'ana'
    await nextTick()
    scope.stop()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await nextTick()

    expect(load).toHaveBeenCalledTimes(2)
  })
})
