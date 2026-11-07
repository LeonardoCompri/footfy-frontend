<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { useAppTheme } from '@/composables/useAppTheme'
import logoLight from '@/assets/brand/futy-verde-classico.svg'
import logoDark from '@/assets/brand/futy-verde-noite.svg'
import symbolLight from '@/assets/brand/futy-simbolo.svg'
import symbolDark from '@/assets/brand/futy-simbolo-noite.svg'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()
const { themeName, isDark, toggleTheme } = useAppTheme()
const rail = ref(false)
const mobileDrawer = ref(false)

const isRail = computed(() => mdAndUp.value && rail.value)
const logo = computed(() => (isDark.value ? logoDark : logoLight))
const symbol = computed(() => (isDark.value ? symbolDark : symbolLight))

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
  permission?: string
  activeOn?: string[]
  myTeam?: boolean
  drawOnly?: boolean
}

const TEAM_PAGES = [
  'admin-teams-detail',
  'admin-players-detail',
  'admin-technical-committee-members-detail',
]

const navItems: NavItem[] = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', routeName: 'admin-dashboard' },
  {
    title: 'Meu time',
    icon: 'mdi-shield-account',
    routeName: 'admin-teams-detail',
    roles: ['coach'],
    activeOn: TEAM_PAGES,
    myTeam: true,
  },
  {
    title: 'Times',
    icon: 'mdi-shield',
    routeName: 'admin-teams-list',
    activeOn: TEAM_PAGES,
  },
  { title: 'Estádios', icon: 'mdi-stadium', routeName: 'admin-stadiums-list' },
  {
    title: 'Partidas',
    icon: 'mdi-soccer-field',
    routeName: 'admin-games-list',
    permission: 'game:read',
    activeOn: ['admin-games-detail'],
  },
  {
    title: 'Sorteio',
    icon: 'mdi-dice-multiple-outline',
    routeName: 'admin-league-draw',
    permission: 'game:read',
    drawOnly: true,
  },
  { title: 'Tabela', icon: 'mdi-format-list-numbered', routeName: 'admin-league-table' },
  {
    title: 'Regulamento',
    icon: 'mdi-file-document-edit-outline',
    routeName: 'admin-league-rules',
    permission: 'tournament:update',
  },
  { title: 'Estatísticas', icon: 'mdi-chart-bar', routeName: 'admin-league-statistics' },
  {
    title: 'Usuários',
    icon: 'mdi-account-cog',
    routeName: 'admin-users-list',
    roles: ['master', 'admin'],
  },
]

const leagueId = computed(() => (route.meta.requiresLeague ? route.params.leagueId : undefined))

const navLeagueId = computed(
  () =>
    leagueId.value ?? (route.name === 'admin-profile' ? leagueContext.activeLeagueId : undefined),
)
const inLeague = computed(() => !!navLeagueId.value && !!leagueContext.activeLeague)

onMounted(() => {
  if (leagueContext.activeLeagueId) leagueContext.loadLeagues().catch(() => undefined)
})

const myTeamId = computed(() => (authStore.hasRole('coach') ? authStore.user?.team?.id : undefined))

const visibleNavItems = computed(() =>
  navItems
    .filter((item) => !item.roles || item.roles.some((role) => authStore.hasRole(role)))
    .filter((item) => !item.permission || authStore.hasPermission(item.permission))
    .filter((item) => !item.myTeam || myTeamId.value)
    .filter((item) => !item.drawOnly || leagueContext.activeLeague?.fixture_mode === 'draw')
    .map((item) => ({
      ...item,
      to: {
        name: item.routeName,
        params: { leagueId: navLeagueId.value, ...(item.myTeam ? { teamId: myTeamId.value } : {}) },
      },
    })),
)

function isActive(item: NavItem): true | undefined {
  if (!item.activeOn?.includes(String(route.name))) return undefined
  const onMyTeam = !!myTeamId.value && Number(route.params.teamId) === myTeamId.value
  return (item.myTeam ? onMyTeam : !onMyTeam) || undefined
}

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
      :rail="isRail"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
      color="surface"
    >
      <div
        class="drawer-brand d-flex flex-column align-center justify-center"
        :class="isRail ? 'drawer-brand--rail' : 'py-4 px-3'"
        data-test="drawer-brand"
      >
        <img v-if="isRail" :src="symbol" alt="Futy" height="30" class="d-block" />
        <template v-else>
          <img :src="logo" alt="Futy" height="54" class="d-block" />
          <span class="text-caption text-medium-emphasis mt-1">Painel Administrativo</span>
        </template>
      </div>
      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          v-for="item in visibleNavItems"
          :key="item.routeName"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          :exact="item.routeName === 'admin-dashboard'"
          :active="isActive(item)"
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
      <v-toolbar-title v-if="!inLeague" class="toolbar-title">
        <RouterLink
          :to="{ name: 'admin-home' }"
          class="d-flex align-center ga-2 text-decoration-none"
          data-test="home-link"
        >
          <img :src="logo" alt="Futy" height="34" class="d-block" />
          <span class="font-heading font-weight-bold">Admin</span>
        </RouterLink>
      </v-toolbar-title>

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

      <v-menu location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            prepend-icon="mdi-account-circle"
            append-icon="mdi-menu-down"
            aria-label="Menu da conta"
            class="text-none mr-2"
            data-test="account-menu"
          >
            <span class="d-none d-md-inline">{{ authStore.user?.name }}</span>
          </v-btn>
        </template>
        <v-list density="compact" nav>
          <v-list-item
            prepend-icon="mdi-account-edit"
            title="Meu perfil"
            :to="{ name: 'admin-profile' }"
            data-test="profile-link"
          />
          <v-list-item
            prepend-icon="mdi-logout"
            title="Sair"
            data-test="logout"
            @click="handleLogout"
          />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 pa-md-6">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="`${leagueId ?? 'no-league'}:${route.params.teamId ?? ''}`"
          />
        </RouterView>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.toolbar-title {
  flex: none;
}
.toolbar-title a {
  color: inherit;
}
.drawer-brand {
  overflow: hidden;
}
.drawer-brand--rail {
  height: 64px;
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
