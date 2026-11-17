import http from './http'
import { paginatedList, unwrap } from './resource'
import type { Championship, ChampionshipListParams } from '@/types/championship'

const baseUrl = '/public/championships'

export const publicChampionshipsService = {
  list: () => unwrap<Championship[]>(http.get(baseUrl)),
  listPaginated: paginatedList<Championship, ChampionshipListParams>(baseUrl),
  get: (id: number | string) => unwrap<Championship>(http.get(`${baseUrl}/${id}`)),
}
