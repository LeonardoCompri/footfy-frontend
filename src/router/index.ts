import { createRouter, createWebHistory } from 'vue-router'
import { publicRoutes, adminRoutes } from './routes'
import { registerGuards } from './guards'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    permission?: string
    // Papéis aceitos (qualquer um deles libera a rota).
    roles?: string[]
    // Rota escopada por `:leagueId`; o guard valida o acesso e ativa a liga no contexto.
    requiresLeague?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...publicRoutes, ...adminRoutes],
})

registerGuards(router)

export default router
