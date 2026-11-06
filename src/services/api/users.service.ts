import http from './http'
import { createResourceService, unwrap } from './resource'
import type { User, UserPayload } from '@/types/user'

const baseUrl = '/users'

export const usersService = {
  ...createResourceService<User, UserPayload>(baseUrl),
  attachLeagues: (id: number | string, leagueIds: number[]) =>
    unwrap<User>(http.post(`${baseUrl}/${id}/leagues`, { league_ids: leagueIds })),
  detachLeague: (id: number | string, leagueId: number | string) =>
    unwrap<User>(http.delete(`${baseUrl}/${id}/leagues/${leagueId}`)),
}
