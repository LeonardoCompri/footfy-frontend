import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { SEARCH_DEBOUNCE_MS } from './useServerTable'

export interface RemoteSelectOption {
  id: number
  title: string
}

interface RemoteSelectConfig<T> {
  fetch: (search: string) => Promise<T[]>
  title: (item: T) => string
  onError: () => void
}

export function useRemoteSelect<T extends { id: number }>(config: RemoteSelectConfig<T>) {
  const results = shallowRef<T[]>([])
  const selected = shallowRef<T | null>(null)
  const loading = ref(false)
  let appliedSearch: string | null = null
  let requestId = 0
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  const items = computed<RemoteSelectOption[]>(() => {
    const current = selected.value
    const list =
      current && !results.value.some((item) => item.id === current.id)
        ? [current, ...results.value]
        : results.value
    return list.map((item) => ({ id: item.id, title: config.title(item) }))
  })

  async function run(search: string) {
    const id = ++requestId
    appliedSearch = search
    loading.value = true
    try {
      const data = await config.fetch(search)
      if (id === requestId) results.value = data
    } catch {
      if (id !== requestId) return
      appliedSearch = null
      config.onError()
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function load() {
    if (appliedSearch === null) return run('')
  }

  function search(value: string | null) {
    const term = value?.trim() ?? ''
    const normalized = selected.value && term === config.title(selected.value) ? '' : term
    clearTimeout(searchTimer)
    if (normalized === appliedSearch) return
    searchTimer = setTimeout(() => run(normalized), SEARCH_DEBOUNCE_MS)
  }

  function select(id: number | null) {
    if (id === null) {
      selected.value = null
      return
    }
    selected.value = [selected.value, ...results.value].find((item) => item?.id === id) ?? null
  }

  function reset(current: T | null) {
    clearTimeout(searchTimer)
    requestId++
    appliedSearch = null
    loading.value = false
    results.value = []
    selected.value = current
  }

  onScopeDispose(() => clearTimeout(searchTimer))

  return { items, loading, selected, load, search, select, reset }
}
