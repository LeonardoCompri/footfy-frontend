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
    ],
  },
]
