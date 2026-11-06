import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { useLeagueContextStore } from '@/stores/leagueContext'

const idProp = (route: RouteLocationNormalized) => ({ id: route.params.id })
const teamProp = (route: RouteLocationNormalized) => ({ teamId: route.params.teamId })
const teamMemberProps = (route: RouteLocationNormalized) => ({
  teamId: route.params.teamId,
  id: route.params.id,
})

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
        path: 'perfil',
        name: 'admin-profile',
        component: () => import('@/views/admin/profile/ProfileView.vue'),
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
            path: 'times/:teamId',
            name: 'admin-teams-detail',
            component: () => import('@/views/admin/teams/TeamDetailView.vue'),
            props: teamProp,
          },
          {
            path: 'times/:teamId/jogadores/:id',
            name: 'admin-players-detail',
            component: () => import('@/views/admin/players/PlayerDetailView.vue'),
            props: teamMemberProps,
          },
          {
            path: 'times/:teamId/comissao-tecnica/:id',
            name: 'admin-technical-committee-members-detail',
            component: () =>
              import('@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberDetailView.vue'),
            props: teamMemberProps,
          },
          {
            path: 'estadios',
            name: 'admin-stadiums-list',
            component: () => import('@/views/admin/stadiums/StadiumAdminListView.vue'),
          },
          {
            path: 'partidas',
            name: 'admin-games-list',
            component: () => import('@/views/admin/games/GameAdminListView.vue'),
            meta: { permission: 'game:read' },
          },
          {
            path: 'partidas/:id',
            name: 'admin-games-detail',
            component: () => import('@/views/admin/games/GameDetailView.vue'),
            props: idProp,
            meta: { permission: 'game:read' },
          },
          {
            path: 'usuarios',
            name: 'admin-users-list',
            component: () => import('@/views/admin/users/UserAdminListView.vue'),
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
