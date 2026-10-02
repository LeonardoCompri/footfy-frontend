import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { useLeagueContextStore } from '@/stores/leagueContext'

// Rotas dentro de `liga/:leagueId` só repassam `id` às telas de edição (o `leagueId`
// vem do store de contexto, não de prop).
const idProp = (route: RouteLocationNormalized) => ({ id: route.params.id })

export const publicRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/public/HomeView.vue') },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/views/public/LoginView.vue'),
        meta: { guestOnly: true },
      },
      {
        path: 'campeonatos',
        name: 'championships-list',
        component: () => import('@/views/public/championships/ChampionshipListView.vue'),
      },
      {
        path: 'campeonatos/:id',
        name: 'championships-detail',
        component: () => import('@/views/public/championships/ChampionshipDetailView.vue'),
        props: true,
      },
      {
        path: 'ligas/:id',
        name: 'leagues-detail',
        component: () => import('@/views/public/leagues/LeagueDetailView.vue'),
        props: true,
      },
      {
        path: 'times',
        name: 'teams-list',
        component: () => import('@/views/public/teams/TeamListView.vue'),
      },
      {
        path: 'times/:id',
        name: 'teams-detail',
        component: () => import('@/views/public/teams/TeamDetailView.vue'),
        props: true,
      },
      {
        path: 'partidas/:id',
        name: 'games-detail',
        component: () => import('@/views/public/games/GameDetailView.vue'),
        props: true,
      },
    ],
  },
]

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        // Entrada do painel: volta para a última liga ativa ou cai na seleção.
        path: '',
        name: 'admin-home',
        redirect: () => {
          const leagueContext = useLeagueContextStore()
          return leagueContext.activeLeagueId
            ? { name: 'admin-dashboard', params: { leagueId: leagueContext.activeLeagueId } }
            : { name: 'admin-select-championship' }
        },
      },
      {
        path: 'selecionar',
        name: 'admin-select-championship',
        component: () => import('@/views/admin/context/ChampionshipSelectView.vue'),
      },
      {
        path: 'selecionar/:championshipId',
        name: 'admin-select-league',
        component: () => import('@/views/admin/context/LeagueSelectView.vue'),
        props: true,
      },
      {
        path: 'campeonatos',
        name: 'admin-championships-list',
        component: () => import('@/views/admin/championships/ChampionshipAdminListView.vue'),
        meta: { permission: 'tournament:read' },
      },
      {
        path: 'campeonatos/novo',
        name: 'admin-championships-create',
        component: () => import('@/views/admin/championships/ChampionshipFormView.vue'),
        meta: { permission: 'tournament:create' },
      },
      {
        path: 'campeonatos/:id/editar',
        name: 'admin-championships-edit',
        component: () => import('@/views/admin/championships/ChampionshipFormView.vue'),
        props: true,
        meta: { permission: 'tournament:update' },
      },
      {
        // Rotas escopadas pela Liga ativa. O acesso à liga é validado no guard
        // (meta.requiresLeague) contra GET /leagues, que já vem escopado no backend.
        path: 'liga/:leagueId',
        meta: { requiresLeague: true },
        children: [
          {
            path: '',
            name: 'admin-dashboard',
            component: () => import('@/views/admin/DashboardView.vue'),
          },
          {
            path: 'times',
            name: 'admin-teams-list',
            component: () => import('@/views/admin/teams/TeamAdminListView.vue'),
          },
          {
            path: 'times/novo',
            name: 'admin-teams-create',
            component: () => import('@/views/admin/teams/TeamFormView.vue'),
          },
          {
            path: 'times/:id/editar',
            name: 'admin-teams-edit',
            component: () => import('@/views/admin/teams/TeamFormView.vue'),
            props: idProp,
          },
          {
            path: 'jogadores',
            name: 'admin-players-list',
            component: () => import('@/views/admin/players/PlayerAdminListView.vue'),
          },
          {
            path: 'jogadores/novo',
            name: 'admin-players-create',
            component: () => import('@/views/admin/players/PlayerFormView.vue'),
          },
          {
            path: 'jogadores/:id/editar',
            name: 'admin-players-edit',
            component: () => import('@/views/admin/players/PlayerFormView.vue'),
            props: idProp,
          },
          {
            path: 'estadios',
            name: 'admin-stadiums-list',
            component: () => import('@/views/admin/stadiums/StadiumAdminListView.vue'),
          },
          {
            path: 'estadios/novo',
            name: 'admin-stadiums-create',
            component: () => import('@/views/admin/stadiums/StadiumFormView.vue'),
          },
          {
            path: 'estadios/:id/editar',
            name: 'admin-stadiums-edit',
            component: () => import('@/views/admin/stadiums/StadiumFormView.vue'),
            props: idProp,
          },
          {
            path: 'comissao-tecnica',
            name: 'admin-technical-committee-members-list',
            component: () =>
              import(
                '@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberAdminListView.vue'
              ),
          },
          {
            path: 'comissao-tecnica/novo',
            name: 'admin-technical-committee-members-create',
            component: () =>
              import('@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberFormView.vue'),
          },
          {
            path: 'comissao-tecnica/:id/editar',
            name: 'admin-technical-committee-members-edit',
            component: () =>
              import('@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberFormView.vue'),
            props: idProp,
          },
          {
            path: 'partidas',
            name: 'admin-games-list',
            component: () => import('@/views/admin/games/GameAdminListView.vue'),
          },
          {
            path: 'partidas/novo',
            name: 'admin-games-create',
            component: () => import('@/views/admin/games/GameFormView.vue'),
          },
          {
            path: 'partidas/:id/editar',
            name: 'admin-games-edit',
            component: () => import('@/views/admin/games/GameFormView.vue'),
            props: idProp,
          },
          {
            path: 'usuarios',
            name: 'admin-users-list',
            component: () => import('@/views/admin/users/UserAdminListView.vue'),
            meta: { roles: ['master', 'admin'] },
          },
          {
            path: 'usuarios/novo',
            name: 'admin-users-create',
            component: () => import('@/views/admin/users/UserFormView.vue'),
            meta: { roles: ['master'] },
          },
          {
            path: 'usuarios/:id/editar',
            name: 'admin-users-edit',
            component: () => import('@/views/admin/users/UserFormView.vue'),
            props: idProp,
            meta: { roles: ['master', 'admin'] },
          },
          {
            path: 'tabela',
            name: 'admin-league-table',
            component: () => import('@/views/admin/leagues/LeagueTableView.vue'),
          },
          {
            path: 'estatisticas',
            name: 'admin-league-statistics',
            component: () => import('@/views/admin/leagues/LeagueStatisticsView.vue'),
          },
        ],
      },
    ],
  },
]
