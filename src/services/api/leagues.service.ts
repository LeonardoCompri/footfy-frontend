import http from './http'
import { createResourceService, unwrap } from './resource'
import type { League, LeaguePayload } from '@/types/championship'
import type { LeagueDashboard } from '@/types/dashboard'
import type { GroupAssignment, LeagueGroups, LeagueRules } from '@/types/leagueRules'
import type { LeagueStatistics, LeagueTable } from '@/types/leagueStats'

const baseUrl = '/leagues'

export const leaguesService = {
  ...createResourceService<League, LeaguePayload | LeagueRules>(baseUrl),
  dashboard: (id: number | string) => unwrap<LeagueDashboard>(http.get(`${baseUrl}/${id}/dashboard`)),
  table: (id: number | string) => unwrap<LeagueTable>(http.get(`${baseUrl}/${id}/table`)),
  statistics: (id: number | string) => unwrap<LeagueStatistics>(http.get(`${baseUrl}/${id}/statistics`)),
  groups: (id: number | string) => unwrap<LeagueGroups>(http.get(`${baseUrl}/${id}/groups`)),
  saveGroups: (id: number | string, groups: GroupAssignment[]) =>
    unwrap<LeagueGroups>(http.put(`${baseUrl}/${id}/groups`, { groups })),
  shuffleGroups: (id: number | string) =>
    unwrap<LeagueGroups>(http.post(`${baseUrl}/${id}/groups/shuffle`)),
  removeWithPassword: (id: number | string, password: string) =>
    http.delete(`${baseUrl}/${id}`, { data: { password } }),
}
