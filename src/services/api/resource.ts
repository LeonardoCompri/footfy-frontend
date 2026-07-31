import http from './http'
import type { AxiosResponse } from 'axios'

export interface Envelope<T> {
  data: T
}

export const unwrap = <D>(p: Promise<AxiosResponse<Envelope<D>>>) => p.then((res) => res.data.data)

export function createResourceService<T extends { id: number }, P>(baseUrl: string) {
  return {
    list: () => unwrap<T[]>(http.get(baseUrl)),
    get: (id: number | string) => unwrap<T>(http.get(`${baseUrl}/${id}`)),
    create: (payload: P) => unwrap<T>(http.post(baseUrl, payload)),
    update: (id: number | string, payload: P) => unwrap<T>(http.put(`${baseUrl}/${id}`, payload)),
    remove: (id: number | string) => http.delete(`${baseUrl}/${id}`),
  }
}
