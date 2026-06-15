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
}

export interface LoginPayload {
  document: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}
