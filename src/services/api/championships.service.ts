import { createResourceService } from './resource'
import type { Championship, ChampionshipPayload } from '@/types/championship'

export const championshipsService = createResourceService<Championship, ChampionshipPayload>(
  '/tournaments',
)
