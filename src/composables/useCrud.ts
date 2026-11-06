import { ref } from 'vue'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse, Paginated, PaginationMeta } from '@/types/api'
import type { ListParams } from '@/services/api/resource'

interface CrudService<T, P> {
  list: (params?: ListParams) => Promise<T[]>
  get: (id: number | string) => Promise<T>
  create: (payload: P) => Promise<T>
  update: (id: number | string, payload: P) => Promise<T>
  remove: (id: number | string) => Promise<unknown>
  listPaginated?(params: ListParams): Promise<Paginated<T>>
}

export function extractErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<ApiErrorResponse>
  return axiosErr.response?.data?.message ?? 'Ocorreu um erro inesperado.'
}

export function useCrud<T extends { id: number }, P>(service: CrudService<T, P>) {
  const items = ref<T[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})
  const meta = ref<PaginationMeta | null>(null)
  let pageRequestId = 0

  function handleError(err: unknown) {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    if (axiosErr.response?.status === 422) {
      fieldErrors.value = axiosErr.response.data?.errors ?? {}
    }
    errorMessage.value = extractErrorMessage(err)
  }

  async function fetchAll(params?: ListParams) {
    loading.value = true
    errorMessage.value = null
    try {
      items.value = await service.list(params)
    } catch (err) {
      errorMessage.value = extractErrorMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function fetchPage(params: ListParams): Promise<boolean> {
    if (!service.listPaginated) throw new Error('useCrud: o service não implementa listPaginated.')
    const requestId = ++pageRequestId
    loading.value = true
    errorMessage.value = null
    try {
      const result = await service.listPaginated(params)
      if (requestId !== pageRequestId) return false
      items.value = result.data
      meta.value = result.meta
      return true
    } catch (err) {
      if (requestId === pageRequestId) errorMessage.value = extractErrorMessage(err)
      return false
    } finally {
      if (requestId === pageRequestId) loading.value = false
    }
  }

  async function fetchOne(id: number | string): Promise<T | null> {
    loading.value = true
    errorMessage.value = null
    try {
      return await service.get(id)
    } catch (err) {
      errorMessage.value = extractErrorMessage(err)
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
      return id ? await service.update(id, payload) : await service.create(payload)
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
      errorMessage.value = extractErrorMessage(err)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    meta,
    loading,
    errorMessage,
    fieldErrors,
    fetchAll,
    fetchPage,
    fetchOne,
    save,
    destroy,
  }
}
