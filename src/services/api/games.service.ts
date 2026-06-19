import { createResourceService } from './resource'
import type { Game, GamePayload } from '@/types/game'

export const gamesService = createResourceService<Game, GamePayload>('/games')
