import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Championship, League } from '@/types/championship'
import type { AuthUser } from '@/types/auth'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'

export function createTestVuetify() {
  return createVuetify({ components, directives })
}

const Stub = { render: () => null }

// Router mínimo com os nomes de rota que as telas do contexto de liga referenciam.
export function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/admin', name: 'admin-home', component: Stub },
      { path: '/admin/selecionar', name: 'admin-select-championship', component: Stub },
      { path: '/admin/selecionar/:championshipId', name: 'admin-select-league', component: Stub },
      { path: '/admin/campeonatos', name: 'admin-championships-list', component: Stub },
      { path: '/admin/liga/:leagueId', name: 'admin-dashboard', component: Stub },
      { path: '/admin/liga/:leagueId/tabela', name: 'admin-league-table', component: Stub },
      { path: '/admin/liga/:leagueId/partidas', name: 'admin-games-list', component: Stub },
      { path: '/admin/liga/:leagueId/partidas/:id', name: 'admin-games-detail', component: Stub },
      { path: '/admin/liga/:leagueId/estatisticas', name: 'admin-league-statistics', component: Stub },
      { path: '/admin/liga/:leagueId/usuarios', name: 'admin-users-list', component: Stub },
      { path: '/admin/liga/:leagueId/times', name: 'admin-teams-list', component: Stub },
      { path: '/admin/liga/:leagueId/times/:teamId', name: 'admin-teams-detail', component: Stub },
      {
        path: '/admin/liga/:leagueId/times/:teamId/jogadores/:id',
        name: 'admin-players-detail',
        component: Stub,
      },
      {
        path: '/admin/liga/:leagueId/times/:teamId/comissao-tecnica/:id',
        name: 'admin-technical-committee-members-detail',
        component: Stub,
      },
      { path: '/admin/liga/:leagueId/estadios', name: 'admin-stadiums-list', component: Stub },
    ],
  })
}

export const championshipA: Championship = { id: 1, name: 'Brasileiro', image: null }
export const championshipB: Championship = { id: 2, name: 'Copa Regional', image: null }

export function makeLeague(id: number, championship: Championship, extra: Partial<League> = {}): League {
  return {
    id,
    name: `Liga ${id}`,
    start_date: null,
    end_date: null,
    organizer: 'Federação',
    season: '2026',
    format: 'round_robin',
    championship,
    ...extra,
  }
}

// `permissions` simula o retorno do login com as permissões efetivas (FOOT-0030).
export function makeUser(role: string, permissions: string[] = []): AuthUser {
  return {
    id: 1,
    name: 'Usuário Teste',
    email: null,
    document: '00000000000',
    roles: [{ id: 1, name: role, guard_name: 'sanctum' }],
    permissions: permissions.map((name, index) => ({ id: index + 1, name, guard_name: 'sanctum' })),
  }
}

// Sessão autenticada dentro de uma liga ativa (padrão: liga 1), como o guard deixaria.
export function setupLeagueSession(user: AuthUser, leagues: League[] = [makeLeague(1, championshipA)]) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = user
  const context = useLeagueContextStore()
  context.leagues = leagues
  context.loaded = true
  context.setActiveLeague(leagues[0].id)
  return { auth, context }
}
