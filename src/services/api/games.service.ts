import http from './http'
import { createResourceService, unwrap } from './resource'
import type { Paginated } from '@/types/api'
import type { Game, GameListParams, GamePayload, GamePenaltiesPayload } from '@/types/game'

const baseUrl = '/games'
const MAX_PER_PAGE = 100
const MAX_PAGES = 50

function listPaginated(params: GameListParams): Promise<Paginated<Game>> {
  return http.get<Paginated<Game>>(baseUrl, { params }).then((res) => res.data)
}

async function listAll(params: Omit<GameListParams, 'page' | 'per_page'>): Promise<Game[]> {
  const first = await listPaginated({ ...params, page: 1, per_page: MAX_PER_PAGE })
  const lastPage = Math.min(first.meta.last_page, MAX_PAGES)
  if (lastPage <= 1) return first.data
  const pages = Array.from({ length: lastPage - 1 }, (_, index) => index + 2)
  const rest = await Promise.all(
    pages.map((page) => listPaginated({ ...params, page, per_page: MAX_PER_PAGE })),
  )
  return [...first.data, ...rest.flatMap((result) => result.data)]
}

export const gamesService = {
  ...createResourceService<Game, GamePayload>(baseUrl),
  listPaginated,
  listAll,
  updatePenalties: (id: number | string, payload: GamePenaltiesPayload) =>
    unwrap<Game>(http.put(`${baseUrl}/${id}`, payload)),
}
