import http from './http'
import { unwrap } from './resource'
import type { League } from '@/types/championship'

const baseUrl = '/public/leagues'

export const publicLeaguesService = {
  get: (id: number | string) => unwrap<League>(http.get(`${baseUrl}/${id}`)),
}
