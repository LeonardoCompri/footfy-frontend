import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function registerGuards(router: Router) {
  router.beforeEach((to) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
      return { name: 'admin-dashboard' }
    }

    if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
      return { name: 'admin-dashboard' }
    }
  })
}
