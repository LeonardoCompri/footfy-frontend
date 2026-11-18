import http from './http'
import { createResourceService, paginatedList, unwrap } from './resource'
import type { User, UserListParams, UserPayload } from '@/types/user'

const baseUrl = '/users'

export const usersService = {
  ...createResourceService<User, UserPayload>(baseUrl),
  listPaginated: paginatedList<User, UserListParams>(baseUrl),
  attachLeagues: (id: number | string, leagueIds: number[]) =>
    unwrap<User>(http.post(`${baseUrl}/${id}/leagues`, { league_ids: leagueIds })),
  detachLeague: (id: number | string, leagueId: number | string) =>
    unwrap<User>(http.delete(`${baseUrl}/${id}/leagues/${leagueId}`)),
}
