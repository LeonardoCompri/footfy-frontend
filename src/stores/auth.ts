import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/api/auth.service'
import type { AuthUser, LoginPayload } from '@/types/auth'
import { useLeagueContextStore } from './leagueContext'

const STORAGE_KEY = 'footfy_auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  function hasRole(role: string): boolean {
    return user.value?.roles.some((r) => r.name === role) ?? false
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false
    if (hasRole('master')) return true
    const [module] = permission.split(':')
    return user.value.permissions.some((p) => p.name === permission || p.name === `${module}:all`)
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token.value, user: user.value }))
  }

  function restoreSession() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { token: string | null; user: AuthUser | null }
      token.value = parsed.token
      user.value = parsed.user
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function clearSession() {
    token.value = null
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
    useLeagueContextStore().reset()
  }

  async function login(payload: LoginPayload) {
    const { data } = await authService.login(payload)
    // Contexto de liga é por usuário: nunca reaproveita a liga/lista da sessão anterior.
    useLeagueContextStore().reset()
    token.value = data.token
    user.value = data.user
    persist()
  }

  async function logout() {
    try {
      await authService.logout()
    } finally {
      clearSession()
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    hasPermission,
    hasRole,
    login,
    logout,
    restoreSession,
    clearSession,
  }
})
