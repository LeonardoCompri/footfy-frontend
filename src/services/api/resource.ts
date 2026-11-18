import http from './http'
import type { AxiosResponse } from 'axios'
import type { PageResponse, Paginated } from '@/types/api'

export interface Envelope<T> {
  data: T
}

export const unwrap = <D>(p: Promise<AxiosResponse<Envelope<D>>>) => p.then((res) => res.data.data)

export function paginatedList<T, Params extends object>(baseUrl: string) {
  return (params: Params) => http.get<Paginated<T>>(baseUrl, { params }).then((res) => res.data)
}

const MAX_PER_PAGE = 100
const MAX_PAGES = 50

export async function fetchAllPages<T>(
  fetchPage: (page: number, perPage: number) => Promise<PageResponse<T>>,
): Promise<T[]> {
  const first = await fetchPage(1, MAX_PER_PAGE)
  const lastPage = Math.min(first.meta?.last_page ?? 1, MAX_PAGES)
  if (lastPage <= 1) return first.data
  const pages = Array.from({ length: lastPage - 1 }, (_, index) => index + 2)
  const rest = await Promise.all(pages.map((page) => fetchPage(page, MAX_PER_PAGE)))
  return [...first.data, ...rest.flatMap((result) => result.data)]
}

export type ListParams = Record<string, string | number | undefined>

export function createResourceService<T extends { id: number }, P>(baseUrl: string) {
  return {
    list: (params?: ListParams) => unwrap<T[]>(http.get(baseUrl, { params })),
    get: (id: number | string) => unwrap<T>(http.get(`${baseUrl}/${id}`)),
    create: (payload: P) => unwrap<T>(http.post(baseUrl, payload)),
    update: (id: number | string, payload: P) => unwrap<T>(http.put(`${baseUrl}/${id}`, payload)),
    remove: (id: number | string) => http.delete(`${baseUrl}/${id}`),
  }
}
