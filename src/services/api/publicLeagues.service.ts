import http from './http'
import { unwrap } from './resource'
import type { PageParams, Paginated } from '@/types/api'
import type { League } from '@/types/championship'
import type { Game } from '@/types/game'
import type { LeagueStatistics, LeagueTable } from '@/types/leagueStats'

const baseUrl = '/public/leagues'

export const publicLeaguesService = {
  get: (id: number | string) => unwrap<League>(http.get(`${baseUrl}/${id}`)),
  games: (id: number | string, params: PageParams) =>
    http.get<Paginated<Game>>(`${baseUrl}/${id}/games`, { params }).then((res) => res.data),
  table: (id: number | string) => unwrap<LeagueTable>(http.get(`${baseUrl}/${id}/table`)),
  statistics: (id: number | string) => unwrap<LeagueStatistics>(http.get(`${baseUrl}/${id}/statistics`)),
}
