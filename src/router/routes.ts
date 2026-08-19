import type { RouteRecordRaw } from 'vue-router'

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
        name: 'admin-dashboard',
        component: () => import('@/views/admin/DashboardView.vue'),
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
        path: 'times',
        name: 'admin-teams-list',
        component: () => import('@/views/admin/teams/TeamAdminListView.vue'),
        meta: { permission: 'team:read' },
      },
      {
        path: 'times/novo',
        name: 'admin-teams-create',
        component: () => import('@/views/admin/teams/TeamFormView.vue'),
        meta: { permission: 'team:create' },
      },
      {
        path: 'times/:id/editar',
        name: 'admin-teams-edit',
        component: () => import('@/views/admin/teams/TeamFormView.vue'),
        props: true,
        meta: { permission: 'team:update' },
      },
      {
        path: 'jogadores',
        name: 'admin-players-list',
        component: () => import('@/views/admin/players/PlayerAdminListView.vue'),
        meta: { permission: 'player:read' },
      },
      {
        path: 'jogadores/novo',
        name: 'admin-players-create',
        component: () => import('@/views/admin/players/PlayerFormView.vue'),
        meta: { permission: 'player:create' },
      },
      {
        path: 'jogadores/:id/editar',
        name: 'admin-players-edit',
        component: () => import('@/views/admin/players/PlayerFormView.vue'),
        props: true,
        meta: { permission: 'player:update' },
      },
      {
        path: 'estadios',
        name: 'admin-stadiums-list',
        component: () => import('@/views/admin/stadiums/StadiumAdminListView.vue'),
        meta: { permission: 'stadium:read' },
      },
      {
        path: 'estadios/novo',
        name: 'admin-stadiums-create',
        component: () => import('@/views/admin/stadiums/StadiumFormView.vue'),
        meta: { permission: 'stadium:create' },
      },
      {
        path: 'estadios/:id/editar',
        name: 'admin-stadiums-edit',
        component: () => import('@/views/admin/stadiums/StadiumFormView.vue'),
        props: true,
        meta: { permission: 'stadium:update' },
      },
      {
        path: 'comissao-tecnica',
        name: 'admin-technical-committee-members-list',
        component: () =>
          import(
            '@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberAdminListView.vue'
          ),
        meta: { permission: 'technical_committee_member:read' },
      },
      {
        path: 'comissao-tecnica/novo',
        name: 'admin-technical-committee-members-create',
        component: () =>
          import('@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberFormView.vue'),
        meta: { permission: 'technical_committee_member:create' },
      },
      {
        path: 'comissao-tecnica/:id/editar',
        name: 'admin-technical-committee-members-edit',
        component: () =>
          import('@/views/admin/technicalCommitteeMembers/TechnicalCommitteeMemberFormView.vue'),
        props: true,
        meta: { permission: 'technical_committee_member:update' },
      },
      {
        path: 'partidas',
        name: 'admin-games-list',
        component: () => import('@/views/admin/games/GameAdminListView.vue'),
        meta: { permission: 'game:read' },
      },
      {
        path: 'partidas/novo',
        name: 'admin-games-create',
        component: () => import('@/views/admin/games/GameFormView.vue'),
        meta: { permission: 'game:create' },
      },
      {
        path: 'partidas/:id/editar',
        name: 'admin-games-edit',
        component: () => import('@/views/admin/games/GameFormView.vue'),
        props: true,
        meta: { permission: 'game:update' },
      },
      {
        path: 'usuarios',
        name: 'admin-users-list',
        component: () => import('@/views/admin/users/UserAdminListView.vue'),
        meta: { permission: 'user:read' },
      },
      {
        path: 'usuarios/novo',
        name: 'admin-users-create',
        component: () => import('@/views/admin/users/UserFormView.vue'),
        meta: { permission: 'user:create' },
      },
      {
        path: 'usuarios/:id/editar',
        name: 'admin-users-edit',
        component: () => import('@/views/admin/users/UserFormView.vue'),
        props: true,
        meta: { permission: 'user:update' },
      },
    ],
  },
]
