import http from './http'
import { createResourceService, fetchAllPages, paginatedList, unwrap } from './resource'
import type { Game, GameListParams, GamePayload, PenaltyKickPayload } from '@/types/game'

const baseUrl = '/games'

const listPaginated = paginatedList<Game, GameListParams>(baseUrl)

function listAll(params: Omit<GameListParams, 'page' | 'per_page'>): Promise<Game[]> {
  return fetchAllPages((page, per_page) => listPaginated({ ...params, page, per_page }))
}

export const gamesService = {
  ...createResourceService<Game, GamePayload>(baseUrl),
  listPaginated,
  listAll,
  updatePenaltyKicks: (id: number | string, kicks: PenaltyKickPayload[]) =>
    unwrap<Game>(http.put(`${baseUrl}/${id}/penalty-kicks`, { kicks })),
}
