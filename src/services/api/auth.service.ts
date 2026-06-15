import http from './http'
import type { LoginPayload, LoginResponse } from '@/types/auth'

export const authService = {
  login: (payload: LoginPayload) => http.post<LoginResponse>('/login', payload),
  logout: () => http.post('/logout'),
}
