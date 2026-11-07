import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { adminRoutes, publicRoutes } from '@/router/routes'

vi.mock('@/services/api/http', () => ({ default: {} }))

describe('rotas públicas', () => {
  it('não existe tela em /times', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [...publicRoutes, ...adminRoutes],
    })

    expect(router.resolve('/times').matched).toHaveLength(0)
    expect(router.hasRoute('teams-list')).toBe(false)
    expect(router.resolve('/times/5').name).toBe('teams-detail')
  })
})

describe('súmula impressa', () => {
  it('fica fora do AdminLayout e exige liga e game_event:create', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [...publicRoutes, ...adminRoutes],
    })

    const route = router.resolve('/admin/liga/3/partidas/9/sumula')
    expect(route.name).toBe('admin-games-scoresheet')
    expect(route.matched).toHaveLength(1)
    expect(route.meta).toEqual({
      requiresAuth: true,
      requiresLeague: true,
      permission: 'game_event:create',
    })
    expect(router.resolve('/admin/liga/3/partidas/9').name).toBe('admin-games-detail')
  })
})
