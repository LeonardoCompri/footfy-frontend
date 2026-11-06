import type { Player } from './player'

export interface ProfilePayload {
  name: string
  email: string | null
  password?: string
  password_confirmation?: string
}

export type ProfilePlayerPayload = Pick<Player, 'name' | 'birth_date'>
