import { ref } from 'vue'
import type { AxiosError, AxiosResponse } from 'axios'
import type { ApiErrorResponse } from '@/types/api'

interface CrudService<T, P> {
  list: () => Promise<AxiosResponse<T[]>>
  get: (id: number | string) => Promise<AxiosResponse<T>>
  create: (payload: P) => Promise<AxiosResponse<T>>
  update: (id: number | string, payload: P) => Promise<AxiosResponse<T>>
  remove: (id: number | string) => Promise<unknown>
}

export function useCrud<T extends { id: number }, P>(service: CrudService<T, P>) {
  const items = ref<T[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  function extractMessage(err: unknown): string {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    return axiosErr.response?.data?.message ?? 'Ocorreu um erro inesperado.'
  }

  function handleError(err: unknown) {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    if (axiosErr.response?.status === 422) {
      fieldErrors.value = axiosErr.response.data?.errors ?? {}
    }
    errorMessage.value = extractMessage(err)
  }

  async function fetchAll() {
    loading.value = true
    errorMessage.value = null
    try {
      const { data } = await service.list()
      items.value = data
    } catch (err) {
      errorMessage.value = extractMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: number | string): Promise<T | null> {
    loading.value = true
    errorMessage.value = null
    try {
      const { data } = await service.get(id)
      return data
    } catch (err) {
      errorMessage.value = extractMessage(err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function save(payload: P, id?: number | string): Promise<T | null> {
    loading.value = true
    errorMessage.value = null
    fieldErrors.value = {}
    try {
      const { data } = id ? await service.update(id, payload) : await service.create(payload)
      return data
    } catch (err) {
      handleError(err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function destroy(id: number | string): Promise<boolean> {
    loading.value = true
    errorMessage.value = null
    try {
      await service.remove(id)
      items.value = items.value.filter((item) => item.id !== id)
      return true
    } catch (err) {
      errorMessage.value = extractMessage(err)
      return false
    } finally {
      loading.value = false
    }
  }

  return { items, loading, errorMessage, fieldErrors, fetchAll, fetchOne, save, destroy }
}
