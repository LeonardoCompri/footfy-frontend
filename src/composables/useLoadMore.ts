import { computed, ref, shallowRef } from 'vue'
import type { PageParams, Paginated, PaginationMeta } from '@/types/api'
import { extractErrorMessage } from '@/composables/useCrud'

export function useLoadMore<T, F extends object>(
  load: (params: F & PageParams) => Promise<Paginated<T>>,
  perPage: number,
) {
  const items = shallowRef<T[]>([])
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const errorMessage = ref<string | null>(null)
  const hasMore = computed(() => !!meta.value && meta.value.current_page < meta.value.last_page)
  let filters = {} as F
  let requestId = 0

  async function fetchPage(page: number) {
    const id = ++requestId
    errorMessage.value = null
    try {
      const result = await load({ ...filters, page, per_page: perPage })
      if (id !== requestId) return
      items.value = page === 1 ? result.data : [...items.value, ...result.data]
      meta.value = result.meta
    } catch (err) {
      if (id === requestId) errorMessage.value = extractErrorMessage(err)
    } finally {
      if (id === requestId) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  function reset(newFilters: F) {
    filters = newFilters
    items.value = []
    meta.value = null
    loading.value = true
    loadingMore.value = false
    return fetchPage(1)
  }

  async function loadMore() {
    if (!meta.value || !hasMore.value || loadingMore.value || loading.value) return
    loadingMore.value = true
    await fetchPage(meta.value.current_page + 1)
  }

  return { items, meta, loading, loadingMore, errorMessage, hasMore, reset, loadMore }
}
