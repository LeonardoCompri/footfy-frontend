<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppTheme } from '@/composables/useAppTheme'

const authStore = useAuthStore()
const router = useRouter()
const { themeName, isDark, toggleTheme } = useAppTheme()
const rail = ref(false)

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
  {
    title: 'Comissão Técnica',
    icon: 'mdi-account-tie',
    to: { name: 'admin-technical-committee-members-list' },
    permission: 'technical_committee_member:read',
  },
  {
    title: 'Partidas',
    icon: 'mdi-soccer-field',
    to: { name: 'admin-games-list' },
    permission: 'game:read',
  },
  {
    title: 'Usuários',
    icon: 'mdi-account-cog',
    to: { name: 'admin-users-list' },
    permission: 'user:read',
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
  <v-app :theme="themeName">
    <v-navigation-drawer :rail="rail" permanent color="surface">
      <v-list-item class="py-3">
        <template #prepend>
          <v-avatar color="primary" variant="flat">
            <v-icon icon="mdi-soccer" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-bold">Footfy</v-list-item-title>
        <v-list-item-subtitle>Painel Administrativo</v-list-item-subtitle>
      </v-list-item>
      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          v-for="item in visibleNavItems"
          :key="item.title"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          color="primary"
          rounded="lg"
        />
      </v-list>

      <template #append>
        <v-divider />
        <v-list density="compact" nav>
          <v-list-item
            :prepend-icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            :title="rail ? '' : 'Recolher'"
            rounded="lg"
            @click="rail = !rail"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar>
      <v-toolbar-title>Footfy Admin</v-toolbar-title>
      <v-spacer />
      <v-btn
        :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        @click="toggleTheme"
      />
      <span class="mx-4">{{ authStore.user?.name }}</span>
      <v-btn variant="text" prepend-icon="mdi-logout" @click="handleLogout">Sair</v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>
