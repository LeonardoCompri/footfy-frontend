import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ServerTableParams } from '@/types/api'

export interface TableSortItem {
  key: string
  order?: boolean | 'asc' | 'desc'
}

export const SERVER_TABLE_PER_PAGE_OPTIONS = [10, 20, 50, 100]
export const SEARCH_DEBOUNCE_MS = 300
const DEFAULT_PER_PAGE = 20

export function useServerTable<S extends string>(load: (params: ServerTableParams<S>) => unknown) {
  const search = ref<string | null>('')
  const appliedSearch = ref('')
  const page = ref(1)
  const perPage = ref(DEFAULT_PER_PAGE)
  const sortBy = ref<TableSortItem[]>([])
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  const params = computed<ServerTableParams<S>>(() => {
    const result: ServerTableParams<S> = { page: page.value, per_page: perPage.value }
    if (appliedSearch.value) result.search = appliedSearch.value
    const sort = sortBy.value[0]
    if (sort) {
      result.sort = sort.key as S
      result.order = sort.order === 'desc' ? 'desc' : 'asc'
    }
    return result
  })

  function reload() {
    return load(params.value)
  }

  watch(search, (value) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const term = value?.trim() ?? ''
      if (term === appliedSearch.value) return
      appliedSearch.value = term
      page.value = 1
    }, SEARCH_DEBOUNCE_MS)
  })

  watch(() => JSON.stringify(params.value), reload, { immediate: true })

  onScopeDispose(() => clearTimeout(searchTimer))

  return { search, appliedSearch, page, perPage, sortBy, reload }
}
