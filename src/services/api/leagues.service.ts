import http from './http'
import { createResourceService, unwrap } from './resource'
import type { League, LeaguePayload } from '@/types/championship'
import type { LeagueDashboard } from '@/types/dashboard'
import type { LeagueStatistics, LeagueTable } from '@/types/leagueStats'

const baseUrl = '/leagues'

export const leaguesService = {
  ...createResourceService<League, LeaguePayload>(baseUrl),
  dashboard: (id: number | string) => unwrap<LeagueDashboard>(http.get(`${baseUrl}/${id}/dashboard`)),
  table: (id: number | string) => unwrap<LeagueTable>(http.get(`${baseUrl}/${id}/table`)),
  statistics: (id: number | string) => unwrap<LeagueStatistics>(http.get(`${baseUrl}/${id}/statistics`)),
}
