import type { Player } from './player'

// PUT /me: só nome, e-mail e senha da própria conta (o backend ignora qualquer outro campo).
export interface ProfilePayload {
  name: string
  email: string | null
  password?: string
  password_confirmation?: string
}

// PUT /me/player: o player só edita nome e data de nascimento do jogador vinculado.
export type ProfilePlayerPayload = Pick<Player, 'name' | 'birth_date'>
