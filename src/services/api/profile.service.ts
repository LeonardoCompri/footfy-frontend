import http from './http'
import { unwrap } from './resource'
import type { Player } from '@/types/player'
import type { ProfilePayload, ProfilePlayerPayload } from '@/types/profile'
import type { User } from '@/types/user'

const baseUrl = '/me'

// Conta do usuário autenticado: fora do escopo de liga, vale para qualquer papel.
export const profileService = {
  get: () => unwrap<User>(http.get(baseUrl)),
  update: (payload: ProfilePayload) => unwrap<User>(http.put(baseUrl, payload)),
  // 404 sem jogador vinculado; 422 (só `message`) quando o jogador foi removido do elenco.
  updatePlayer: (payload: ProfilePlayerPayload) =>
    unwrap<Player>(http.put(`${baseUrl}/player`, payload)),
}
