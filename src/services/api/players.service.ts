import { createResourceService } from './resource'
import type { Player, PlayerPayload } from '@/types/player'

export const playersService = createResourceService<Player, PlayerPayload>('/players')
