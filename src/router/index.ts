import { createRouter, createWebHistory } from 'vue-router'
import { publicRoutes, adminRoutes } from './routes'
import { registerGuards } from './guards'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    permission?: string
    roles?: string[]
    requiresLeague?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...publicRoutes, ...adminRoutes],
})

registerGuards(router)

export default router
