import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { useAuthStore } from '@/stores/auth'
import { leaguesService } from '@/services/api/leagues.service'
import { championshipsService } from '@/services/api/championships.service'
import { authService } from '@/services/api/auth.service'
import { championshipA, championshipB, makeLeague, makeUser } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), dashboard: vi.fn() },
}))
vi.mock('@/services/api/championships.service', () => ({
  championshipsService: { list: vi.fn() },
}))
vi.mock('@/services/api/auth.service', () => ({
  authService: { login: vi.fn(), logout: vi.fn() },
}))

describe('leagueContext store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(leaguesService.list).mockResolvedValue([
      makeLeague(1, championshipA),
      makeLeague(2, championshipB),
      makeLeague(3, championshipA),
    ])
    vi.mocked(championshipsService.list).mockReset()
    vi.mocked(championshipsService.list).mockResolvedValue([
      { id: 9, name: 'Amador', image: null },
      championshipA,
      championshipB,
      { id: 8, name: 'Copa Nova', image: null },
    ])
  })

  function login(role: string) {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = makeUser(role)
  }

  it('agrupa as ligas acessíveis por campeonato', async () => {
    const context = useLeagueContextStore()
    await context.loadLeagues()

    expect(context.championships.map((g) => g.championship.name)).toEqual([
      'Brasileiro',
      'Copa Regional',
    ])
    expect(context.leaguesOf(1).map((l) => l.id)).toEqual([1, 3])
    expect(context.hasAccess(2)).toBe(true)
    expect(context.hasAccess(42)).toBe(false)
  })

  it('master também vê os campeonatos sem liga, na ordem por nome', async () => {
    login('master')
    const context = useLeagueContextStore()
    await context.loadLeagues()

    expect(
      context.championships.map((g) => [g.championship.name, g.leagues.map((l) => l.id)]),
    ).toEqual([
      ['Amador', []],
      ['Brasileiro', [1, 3]],
      ['Copa Nova', []],
      ['Copa Regional', [2]],
    ])
    expect(context.leaguesOf(8)).toEqual([])
  })

  it('quem não é master não busca GET /championships', async () => {
    login('admin')
    const context = useLeagueContextStore()
    await context.loadLeagues()

    expect(championshipsService.list).not.toHaveBeenCalled()
    expect(context.championships).toHaveLength(2)
  })

  it('clearActiveLeague limpa a liga ativa e o localStorage, sem apagar as ligas', async () => {
    const context = useLeagueContextStore()
    await context.loadLeagues()
    context.setActiveLeague(3)

    context.clearActiveLeague()

    expect(context.activeLeagueId).toBeNull()
    expect(context.activeLeague).toBeNull()
    expect(localStorage.getItem('footfy_active_league')).toBeNull()
    expect(context.leagues).toHaveLength(3)
  })

  it('restaura a liga ativa salva após recarregar a página', () => {
    localStorage.setItem('footfy_active_league', '3')
    expect(useLeagueContextStore().activeLeagueId).toBe(3)
  })

  it('logout limpa o contexto de liga sem deixar resíduo para o próximo usuário', async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined as never)
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = makeUser('admin')

    const context = useLeagueContextStore()
    await context.loadLeagues()
    context.setActiveLeague(1)
    context.dashboardCache.set(1, {} as never)

    await auth.logout()

    expect(context.activeLeagueId).toBeNull()
    expect(context.leagues).toEqual([])
    expect(context.dashboardCache.size).toBe(0)
    expect(localStorage.getItem('footfy_active_league')).toBeNull()
  })
})
