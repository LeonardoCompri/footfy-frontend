<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const drawer = ref(true)

interface NavItem {
  title: string
  icon: string
  to: { name: string }
  permission?: string
}

const navItems: NavItem[] = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', to: { name: 'admin-dashboard' } },
  {
    title: 'Campeonatos',
    icon: 'mdi-trophy',
    to: { name: 'admin-championships-list' },
    permission: 'tournament:read',
  },
  {
    title: 'Times',
    icon: 'mdi-shield',
    to: { name: 'admin-teams-list' },
    permission: 'team:read',
  },
  {
    title: 'Jogadores',
    icon: 'mdi-account-group',
    to: { name: 'admin-players-list' },
    permission: 'player:read',
  },
  {
    title: 'Estádios',
    icon: 'mdi-stadium',
    to: { name: 'admin-stadiums-list' },
    permission: 'stadium:read',
  },
]

const visibleNavItems = navItems.filter(
  (item) => !item.permission || authStore.hasPermission(item.permission),
)

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" color="primary" theme="dark">
      <v-list-item title="Footfy" subtitle="Painel Administrativo" class="py-4" />
      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          v-for="item in visibleNavItems"
          :key="item.title"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar elevation="1">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Footfy Admin</v-toolbar-title>
      <v-spacer />
      <span class="mr-4">{{ authStore.user?.name }}</span>
      <v-btn variant="text" prepend-icon="mdi-logout" @click="handleLogout">Sair</v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>
