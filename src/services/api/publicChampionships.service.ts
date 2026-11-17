import http from './http'
import { unwrap } from './resource'
import type { Paginated } from '@/types/api'
import type { Championship, ChampionshipListParams } from '@/types/championship'

const baseUrl = '/public/championships'

export const publicChampionshipsService = {
  list: () => unwrap<Championship[]>(http.get(baseUrl)),
  listPaginated: (params: ChampionshipListParams) =>
    http.get<Paginated<Championship>>(baseUrl, { params }).then((res) => res.data),
  get: (id: number | string) => unwrap<Championship>(http.get(`${baseUrl}/${id}`)),
}
