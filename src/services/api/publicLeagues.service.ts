import http from './http'
import { unwrap } from './resource'
import type { League } from '@/types/championship'
import type { LeagueStatistics, LeagueTable } from '@/types/leagueStats'

const baseUrl = '/public/leagues'

export const publicLeaguesService = {
  get: (id: number | string) => unwrap<League>(http.get(`${baseUrl}/${id}`)),
  table: (id: number | string) => unwrap<LeagueTable>(http.get(`${baseUrl}/${id}/table`)),
  statistics: (id: number | string) => unwrap<LeagueStatistics>(http.get(`${baseUrl}/${id}/statistics`)),
}
