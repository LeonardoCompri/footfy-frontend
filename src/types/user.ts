export type UserRole = 'master' | 'admin' | 'coach' | 'player'

export interface User {
  id: number
  name: string
  email: string | null
  document: string
  roles: string[]
  leagues: { id: number; name: string }[]
  created_at: string
  updated_at: string
}

export interface UserPayload {
  name: string
  email: string | null
  document: string
  password?: string
  // Só master altera papel; para admin o backend ignora o campo (UserService::update).
  role?: UserRole
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
