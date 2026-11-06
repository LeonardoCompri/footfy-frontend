import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'

const SELECT_CHAMPIONSHIP = { name: 'admin-select-championship' } as const

export async function adminGuard(
  to: RouteLocationNormalized,
): Promise<RouteLocationRaw | undefined> {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'admin-home' }
  }

  if (to.meta.requiresLeague) {
    const leagueContext = useLeagueContextStore()
    try {
      await leagueContext.loadLeagues()
    } catch {
      return SELECT_CHAMPIONSHIP
    }

    const leagueId = Number(to.params.leagueId)
    if (!leagueContext.hasAccess(leagueId)) {
      return { ...SELECT_CHAMPIONSHIP, query: { negado: '1' } }
    }
    if (leagueContext.activeLeagueId !== leagueId) {
      leagueContext.setActiveLeague(leagueId)
    }
  }

  if (to.meta.roles && !to.meta.roles.some((role) => authStore.hasRole(role))) {
    return { name: 'admin-home' }
  }

  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    return { name: 'admin-home' }
  }
}

export function registerGuards(router: Router) {
  router.beforeEach(adminGuard)
}
