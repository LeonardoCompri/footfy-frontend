import http from './http'
import type { Championship, ChampionshipPayload } from '@/types/championship'

const BASE_URL = '/tournaments'

export const championshipsService = {
  list: () => http.get<Championship[]>(BASE_URL),
  get: (id: number | string) => http.get<Championship>(`${BASE_URL}/${id}`),
  create: (payload: ChampionshipPayload) => http.post<Championship>(BASE_URL, payload),
  update: (id: number | string, payload: ChampionshipPayload) =>
    http.put<Championship>(`${BASE_URL}/${id}`, payload),
  remove: (id: number | string) => http.delete(`${BASE_URL}/${id}`),
}
