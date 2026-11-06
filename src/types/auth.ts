import type { UserPlayer, UserTeam } from './user'

export interface Role {
  id: number
  name: string
  guard_name: string
}

export interface Permission {
  id: number
  name: string
  guard_name: string
}

export interface AuthUser {
  id: number
  name: string
  email: string | null
  document: string
  roles: Role[]
  permissions: Permission[]
  team?: UserTeam | null
  player?: UserPlayer | null
}

export interface LoginPayload {
  document: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}
