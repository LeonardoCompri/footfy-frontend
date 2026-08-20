import http from './http'
import { unwrap } from './resource'
import type { Team } from '@/types/team'

const baseUrl = '/public/teams'

export const publicTeamsService = {
  get: (id: number | string) => unwrap<Team>(http.get(`${baseUrl}/${id}`)),
}
