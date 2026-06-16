import { createResourceService } from './resource'
import type { Stadium, StadiumPayload } from '@/types/stadium'

export const stadiumsService = createResourceService<Stadium, StadiumPayload>('/stadiums')
