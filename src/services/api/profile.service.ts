import http from './http'
import { unwrap } from './resource'
import type { Player } from '@/types/player'
import type { ProfilePayload, ProfilePlayerPayload } from '@/types/profile'
import type { User } from '@/types/user'

const baseUrl = '/me'

export const profileService = {
  get: () => unwrap<User>(http.get(baseUrl)),
  update: (payload: ProfilePayload) => unwrap<User>(http.put(baseUrl, payload)),
  updatePlayer: (payload: ProfilePlayerPayload) =>
    unwrap<Player>(http.put(`${baseUrl}/player`, payload)),
}
