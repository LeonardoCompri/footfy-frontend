import type { Player } from './player'

export interface Team {
  id: number
  name: string
  nickname: string | null
  logo: string | null
  created_at: string
  updated_at: string
  // Só vem preenchido em GET /public/teams/{id} (eager loaded no backend).
  players?: Player[]
  // TODO: GET /public/teams/{id} ainda não retorna a comissão técnica do time;
  // depende de ajuste no backend (ver card correspondente no board Backend).
}

export type TeamPayload = Pick<Team, 'name' | 'nickname' | 'logo'>
