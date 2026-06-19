import { createResourceService } from './resource'
import type { Coach, CoachPayload } from '@/types/coach'

export const coachesService = createResourceService<Coach, CoachPayload>('/coaches')
