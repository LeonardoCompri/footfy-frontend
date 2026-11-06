import http from './http'
import { createResourceService, unwrap } from './resource'
import type { SelectOption } from '@/types/api'
import type { Player, PlayerPayload } from '@/types/player'

let positionsCache: Promise<SelectOption[]> | null = null

const baseUrl = '/players'

export const playersService = {
  ...createResourceService<Player, PlayerPayload>(baseUrl),
  positions: () =>
    (positionsCache ??= unwrap<SelectOption[]>(http.get(`${baseUrl}/positions`)).catch((err) => {
      positionsCache = null
      throw err
    })),
}
