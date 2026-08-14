import http from './http'
import { createResourceService } from './resource'
import type { User, UserPayload } from '@/types/user'

interface Envelope<T> {
  data: T
}

export const usersService = {
  ...createResourceService<User, UserPayload>('/users'),
  syncLeagues: (id: number | string, leagueIds: number[]) =>
    http
      .post<Envelope<User>>(`/users/${id}/leagues`, { league_ids: leagueIds })
      .then((res) => res.data.data),
  removeLeague: (id: number | string, leagueId: number | string) =>
    http
      .delete<Envelope<User>>(`/users/${id}/leagues/${leagueId}`)
      .then((res) => res.data.data),
}
