export type UserRole = 'master' | 'admin' | 'coach' | 'player'

// Time do coach (users.team_id) ou do jogador vinculado ao player.
export interface UserTeam {
  id: number
  name: string
  logo: string | null
}

// Jogador vinculado ao usuário player (players.user_id).
export interface UserPlayer {
  id: number
  name: string
  team_id: number | null
}

export interface User {
  id: number
  name: string
  email: string | null
  document: string
  roles: string[]
  leagues: { id: number; name: string }[]
  team?: UserTeam | null
  player?: UserPlayer | null
  created_at: string
  updated_at: string
}

export interface UserPayload {
  name: string
  email: string | null
  document: string
  password?: string
  // No update só master envia papel (para os demais o backend rejeita o campo com 422).
  role?: UserRole
  // Vínculo do papel: team_id só para coach e player_id só para player (senão 422).
  team_id?: number | null
  player_id?: number | null
}

export const USER_ROLE_OPTIONS: { value: UserRole; title: string; color: string }[] = [
  { value: 'master', title: 'Master', color: 'secondary' },
  { value: 'admin', title: 'Admin', color: 'primary' },
  { value: 'coach', title: 'Técnico', color: 'info' },
  { value: 'player', title: 'Jogador', color: 'success' },
]

export function userRoleOption(role: string | undefined) {
  return USER_ROLE_OPTIONS.find((option) => option.value === role) ?? { value: role, title: role ?? '—', color: 'default' }
}
