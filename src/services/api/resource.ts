import http from './http'
import type { AxiosResponse } from 'axios'

interface Envelope<T> {
  data: T
}

export function createResourceService<T extends { id: number }, P>(baseUrl: string) {
  const unwrap = <D>(p: Promise<AxiosResponse<Envelope<D>>>) => p.then((res) => res.data.data)

  return {
    list: () => unwrap<T[]>(http.get(baseUrl)),
    get: (id: number | string) => unwrap<T>(http.get(`${baseUrl}/${id}`)),
    create: (payload: P) => unwrap<T>(http.post(baseUrl, payload)),
    update: (id: number | string, payload: P) => unwrap<T>(http.put(`${baseUrl}/${id}`, payload)),
    remove: (id: number | string) => http.delete(`${baseUrl}/${id}`),
  }
}
