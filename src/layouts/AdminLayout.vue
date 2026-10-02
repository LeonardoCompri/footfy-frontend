<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { useAppTheme } from '@/composables/useAppTheme'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()
const { themeName, isDark, toggleTheme } = useAppTheme()
const rail = ref(false)
const mobileDrawer = ref(false)

// No desktop o drawer é permanente e precisa ficar sempre ativo; `mobileDrawer` só controla
// a abertura temporária no mobile (um drawer `permanent` com v-model false fica escondido).
const drawerOpen = computed({
  get: () => mdAndUp.value || mobileDrawer.value,
  set: (value: boolean) => {
    mobileDrawer.value = value
  },
})

interface NavItem {
  title: string
  icon: string
  routeName: string
  roles?: string[]
  // Telas internas (sem rota aninhada) que mantêm o item destacado no menu.
  activeOn?: string[]
}

// Ordem definida no FOOT-0022: Dashboard é a tela inicial ao entrar na liga.
const navItems: NavItem[] = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', routeName: 'admin-dashboard' },
  {
    title: 'Times',
    icon: 'mdi-shield',
    routeName: 'admin-teams-list',
    activeOn: ['admin-teams-detail', 'admin-players-detail', 'admin-technical-committee-members-detail'],
  },
  { title: 'Estádios', icon: 'mdi-stadium', routeName: 'admin-stadiums-list' },
  { title: 'Partidas', icon: 'mdi-soccer-field', routeName: 'admin-games-list' },
  { title: 'Tabela', icon: 'mdi-format-list-numbered', routeName: 'admin-league-table' },
  { title: 'Estatísticas', icon: 'mdi-chart-bar', routeName: 'admin-league-statistics' },
  {
    title: 'Usuários',
    icon: 'mdi-account-cog',
    routeName: 'admin-users-list',
    roles: ['master', 'admin'],
  },
]

// Nav rail e pill só existem dentro de uma rota escopada por liga.
const leagueId = computed(() => (route.meta.requiresLeague ? route.params.leagueId : undefined))
const inLeague = computed(() => !!leagueId.value && !!leagueContext.activeLeague)

const visibleNavItems = computed(() =>
  navItems
    .filter((item) => !item.roles || item.roles.some((role) => authStore.hasRole(role)))
    .map((item) => ({ ...item, to: { name: item.routeName, params: { leagueId: leagueId.value } } })),
)

function switchContext() {
  router.push({ name: 'admin-select-championship' })
}

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <v-app :theme="themeName">
    <v-navigation-drawer
      v-if="inLeague"
      v-model="drawerOpen"
      :rail="mdAndUp && rail"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
      color="surface"
    >
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
          :key="item.routeName"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          :exact="item.routeName === 'admin-dashboard'"
          :active="item.activeOn?.includes(String(route.name)) || undefined"
          color="primary"
          rounded="lg"
        />
      </v-list>

      <template v-if="mdAndUp" #append>
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
      <v-app-bar-nav-icon v-if="inLeague && !mdAndUp" @click="mobileDrawer = !mobileDrawer" />
      <!-- Dentro de uma liga a marca já aparece no drawer; o app bar mostra o pill de contexto. -->
      <v-toolbar-title v-if="!inLeague" class="toolbar-title">Footfy Admin</v-toolbar-title>

      <div v-if="inLeague && leagueContext.activeLeague" class="context-pill d-flex align-center ga-2 pl-3 pr-1 py-1">
        <v-icon icon="mdi-trophy-outline" size="18" color="primary" />
        <span class="text-truncate">
          <span v-if="leagueContext.activeLeague.championship" class="d-none d-sm-inline text-medium-emphasis">
            {{ leagueContext.activeLeague.championship.name }} /
          </span>
          <strong>{{ leagueContext.activeLeague.name }}</strong>
        </span>
        <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-swap-horizontal" @click="switchContext">
          Trocar
        </v-btn>
      </div>

      <v-spacer />
      <v-btn
        :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        @click="toggleTheme"
      />
      <span class="mx-4 d-none d-md-inline">{{ authStore.user?.name }}</span>
      <v-btn variant="text" prepend-icon="mdi-logout" @click="handleLogout">
        <span class="d-none d-sm-inline">Sair</span>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 pa-md-6">
        <!-- key por liga: trocar de liga sempre remonta a tela, sem dados residuais da anterior. -->
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="leagueId ?? 'no-league'" />
        </RouterView>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.toolbar-title {
  flex: none;
}
.context-pill {
  min-width: 0;
  max-width: 100%;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 999px;
  background: rgb(var(--v-theme-surface-variant));
  font-size: 0.875rem;
}
</style>
