import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'
import { adminGuard } from '@/router/guards'
import { adminRoutes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { leaguesService } from '@/services/api/leagues.service'
import { championshipA, championshipB, makeLeague, makeUser } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), dashboard: vi.fn() },
}))

const listLeagues = vi.mocked(leaguesService.list)

function route(partial: Partial<RouteLocationNormalized>): RouteLocationNormalized {
  return { fullPath: '/admin', params: {}, query: {}, meta: {}, ...partial } as RouteLocationNormalized
}

function leagueRoute(leagueId: number, meta: RouteLocationNormalized['meta'] = {}) {
  return route({
    fullPath: `/admin/liga/${leagueId}`,
    params: { leagueId: String(leagueId) },
    meta: { requiresAuth: true, requiresLeague: true, ...meta },
  })
}

function login(role: string, permissions: string[] = []) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser(role, permissions)
}

describe('adminGuard — contexto de Liga ativa', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    listLeagues.mockReset()
    listLeagues.mockResolvedValue([makeLeague(1, championshipA), makeLeague(2, championshipB)])
  })

  it('manda para o login quando não há sessão', async () => {
    const result = await adminGuard(leagueRoute(1))
    expect(result).toEqual({ name: 'login', query: { redirect: '/admin/liga/1' } })
    expect(listLeagues).not.toHaveBeenCalled()
  })

  it('libera a rota e ativa a liga quando o usuário tem acesso', async () => {
    login('admin')
    const result = await adminGuard(leagueRoute(2))

    expect(result).toBeUndefined()
    const context = useLeagueContextStore()
    expect(context.activeLeagueId).toBe(2)
    expect(context.activeLeague?.name).toBe('Liga 2')
    expect(localStorage.getItem('footfy_active_league')).toBe('2')
  })

  it('redireciona para a seleção ao acessar por URL uma liga fora do escopo', async () => {
    login('admin')
    useLeagueContextStore().setActiveLeague(1)

    const result = await adminGuard(leagueRoute(99))

    expect(result).toEqual({ name: 'admin-select-championship', query: { negado: '1' } })
    expect(useLeagueContextStore().activeLeagueId).toBe(1)
  })

  it('troca o contexto ao navegar para outra liga acessível', async () => {
    login('admin')
    await adminGuard(leagueRoute(1))
    await adminGuard(leagueRoute(2))

    expect(useLeagueContextStore().activeLeagueId).toBe(2)
    expect(listLeagues).toHaveBeenCalledTimes(1)
  })

  it('cai na seleção quando GET /leagues falha', async () => {
    login('admin')
    listLeagues.mockRejectedValueOnce(new Error('network'))

    const result = await adminGuard(leagueRoute(1))
    expect(result).toEqual({ name: 'admin-select-championship' })
  })

  it('restringe Usuários a master/admin', async () => {
    const usersMeta = { roles: ['master', 'admin'] }

    login('coach')
    expect(await adminGuard(leagueRoute(1, usersMeta))).toEqual({ name: 'admin-home' })

    login('admin')
    expect(await adminGuard(leagueRoute(1, usersMeta))).toBeUndefined()
  })

  it('Partidas exige game:read (meta.permission das rotas reais)', async () => {
    const leagueChildren = adminRoutes[0].children?.find((r) => r.path === 'liga/:leagueId')?.children ?? []
    for (const name of ['admin-games-list', 'admin-games-detail']) {
      const meta = leagueChildren.find((r) => r.name === name)?.meta ?? {}
      expect(meta.permission).toBe('game:read')

      login('coach', ['team:read', 'stadium:read'])
      expect(await adminGuard(leagueRoute(1, meta))).toEqual({ name: 'admin-home' })

      login('admin', ['game:read'])
      expect(await adminGuard(leagueRoute(1, meta))).toBeUndefined()
    }
  })

  it('Regulamento exige tournament:update (mesma permissão da edição de liga)', async () => {
    const leagueChildren =
      adminRoutes[0].children?.find((r) => r.path === 'liga/:leagueId')?.children ?? []
    const meta = leagueChildren.find((r) => r.name === 'admin-league-rules')?.meta ?? {}
    expect(meta.permission).toBe('tournament:update')

    login('coach', ['team:read'])
    expect(await adminGuard(leagueRoute(1, meta))).toEqual({ name: 'admin-home' })

    login('admin', ['tournament:update'])
    expect(await adminGuard(leagueRoute(1, meta))).toBeUndefined()
    expect(await adminGuard(leagueRoute(999, meta))).toEqual({
      name: 'admin-select-championship',
      query: { negado: '1' },
    })

    login('master')
    expect(await adminGuard(leagueRoute(1, meta))).toBeUndefined()
  })

  it('não existem mais as rotas de formulário de partida/usuário', () => {
    const leagueChildren = adminRoutes[0].children?.find((r) => r.path === 'liga/:leagueId')?.children ?? []
    const names = leagueChildren.map((r) => r.name)
    for (const removed of ['admin-games-create', 'admin-games-edit', 'admin-users-create', 'admin-users-edit']) {
      expect(names).not.toContain(removed)
    }
  })

  it('usuário logado na tela de login vai para a entrada do painel', async () => {
    login('master')
    const result = await adminGuard(route({ meta: { guestOnly: true } }))
    expect(result).toEqual({ name: 'admin-home' })
  })
})

describe('rota /admin (admin-home)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  const homeRedirect = () => {
    const home = adminRoutes[0].children?.find((r) => r.name === 'admin-home')
    return (home?.redirect as () => unknown)()
  }

  it('sem liga ativa vai para a seleção de campeonato', () => {
    expect(homeRedirect()).toEqual({ name: 'admin-select-championship' })
  })

  it('com liga ativa volta para o Dashboard dela', () => {
    useLeagueContextStore().setActiveLeague(7)
    expect(homeRedirect()).toEqual({ name: 'admin-dashboard', params: { leagueId: 7 } })
  })
})
