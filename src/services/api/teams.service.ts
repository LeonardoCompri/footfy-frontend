import { createResourceService } from './resource'
import type { Team, TeamPayload } from '@/types/team'

export const teamsService = createResourceService<Team, TeamPayload>('/teams')
