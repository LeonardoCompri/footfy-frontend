import http from './http'
import { unwrap } from './resource'
import type { Game } from '@/types/game'

const baseUrl = '/public/games'

export const publicGamesService = {
  get: (id: number | string) => unwrap<Game>(http.get(`${baseUrl}/${id}`)),
}
