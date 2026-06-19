import http from './http'
import { createResourceService } from './resource'
import type { User, UserPayload } from '@/types/user'

interface Envelope<T> {
  data: T
}

export const usersService = {
  ...createResourceService<User, UserPayload>('/users'),
  syncChampionships: (id: number | string, championshipIds: number[]) =>
    http
      .post<Envelope<User>>(`/users/${id}/championships`, { championship_ids: championshipIds })
      .then((res) => res.data.data),
  removeChampionship: (id: number | string, championshipId: number | string) =>
    http
      .delete<Envelope<User>>(`/users/${id}/championships/${championshipId}`)
      .then((res) => res.data.data),
}
