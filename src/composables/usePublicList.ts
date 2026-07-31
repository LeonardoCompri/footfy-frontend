import { ref } from 'vue'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types/api'

interface PublicListService<T> {
  list: () => Promise<T[]>
}

export function usePublicList<T>(service: PublicListService<T>) {
  const items = ref<T[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  function extractMessage(err: unknown): string {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    return axiosErr.response?.data?.message ?? 'Ocorreu um erro inesperado.'
  }

  async function fetchAll() {
    loading.value = true
    errorMessage.value = null
    try {
      items.value = await service.list()
    } catch (err) {
      errorMessage.value = extractMessage(err)
    } finally {
      loading.value = false
    }
  }

  return { items, loading, errorMessage, fetchAll }
}
