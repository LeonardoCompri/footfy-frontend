import { createResourceService } from './resource'
import type { League, LeaguePayload } from '@/types/championship'

export const leaguesService = createResourceService<League, LeaguePayload>('/leagues')
