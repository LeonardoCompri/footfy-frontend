import http from './http'
import { createResourceService, fetchAllPages } from './resource'
import type { Paginated } from '@/types/api'
import type { GameEvent, GameEventListParams, GameEventPayload } from '@/types/gameEvent'

const baseUrl = '/game-events'

function listPaginated(params: GameEventListParams): Promise<Paginated<GameEvent>> {
  return http.get<Paginated<GameEvent>>(baseUrl, { params }).then((res) => res.data)
}

function listAll(params: Omit<GameEventListParams, 'page' | 'per_page'>): Promise<GameEvent[]> {
  return fetchAllPages((page, per_page) => listPaginated({ ...params, page, per_page }))
}

export const gameEventsService = {
  ...createResourceService<GameEvent, GameEventPayload>(baseUrl),
  listPaginated,
  listAll,
}
