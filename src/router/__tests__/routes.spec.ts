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
