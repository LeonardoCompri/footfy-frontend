import { ref } from 'vue'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types/api'

interface PublicItemService<T> {
  get: (id: number | string) => Promise<T>
}

/**
 * Busca um único recurso público por id, seguindo o mesmo padrão de tratamento
 * de loading/erro de usePublicList e useCrud.
 */
export function usePublicItem<T>(service: PublicItemService<T>) {
  const item = ref<T | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  function extractMessage(err: unknown): string {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    return axiosErr.response?.data?.message ?? 'Ocorreu um erro inesperado.'
  }

  async function fetchOne(id: number | string) {
    loading.value = true
    errorMessage.value = null
    try {
      item.value = await service.get(id)
    } catch (err) {
      errorMessage.value = extractMessage(err)
    } finally {
      loading.value = false
    }
  }

  return { item, loading, errorMessage, fetchOne }
}
