import http from './http'
import { unwrap } from './resource'
import type { Championship } from '@/types/championship'

const baseUrl = '/public/championships'

export const publicChampionshipsService = {
  list: () => unwrap<Championship[]>(http.get(baseUrl)),
  get: (id: number | string) => unwrap<Championship>(http.get(`${baseUrl}/${id}`)),
}
