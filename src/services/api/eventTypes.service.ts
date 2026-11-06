import { createResourceService } from './resource'
import type { EventTypeMeta, EventTypePayload } from '@/types/gameEvent'

export const eventTypesService = createResourceService<EventTypeMeta, EventTypePayload>(
  '/event-types',
)
