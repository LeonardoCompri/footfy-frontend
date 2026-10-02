import http from './http'
import { createResourceService, unwrap } from './resource'
import type { League, LeaguePayload } from '@/types/championship'
import type { LeagueDashboard } from '@/types/dashboard'

const baseUrl = '/leagues'

export const leaguesService = {
  ...createResourceService<League, LeaguePayload>(baseUrl),
  dashboard: (id: number | string) => unwrap<LeagueDashboard>(http.get(`${baseUrl}/${id}/dashboard`)),
}
