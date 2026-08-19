import { createResourceService } from './resource'
import type { GameEvent, GameEventPayload } from '@/types/gameEvent'

export const gameEventsService = createResourceService<GameEvent, GameEventPayload>(
  '/game-events',
)
