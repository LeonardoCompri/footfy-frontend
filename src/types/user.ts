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
  role: UserRole
}

export const USER_ROLE_OPTIONS: { value: UserRole; title: string }[] = [
  { value: 'master', title: 'Master' },
  { value: 'admin', title: 'Admin' },
  { value: 'coach', title: 'Técnico' },
  { value: 'player', title: 'Jogador' },
]
