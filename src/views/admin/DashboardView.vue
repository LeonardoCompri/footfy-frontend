<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AxiosError } from 'axios'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { DashboardSnapshot } from '@/stores/leagueContext'
import { leaguesService } from '@/services/api/leagues.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import type { ApiErrorResponse } from '@/types/api'
import type { CardsSplit } from '@/types/dashboard'
import StatCard from '@/components/common/StatCard.vue'
import GoalsBarChart from '@/components/dashboard/GoalsBarChart.vue'
import ResultsSplitBar from '@/components/dashboard/ResultsSplitBar.vue'
import CardsBarChart from '@/components/dashboard/CardsBarChart.vue'
import GameMiniList from '@/components/dashboard/GameMiniList.vue'

const leagueContext = useLeagueContextStore()

// O layout remonta esta tela por liga (key), então a liga ativa é fixa durante a vida dela.
const league = computed(() => leagueContext.activeLeague)
const leagueId = leagueContext.activeLeagueId as number

const snapshot = ref<DashboardSnapshot | null>(leagueContext.dashboardCache.get(leagueId) ?? null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

const dashboard = computed(() => snapshot.value?.dashboard ?? null)

const counters = computed(() => {
  const c = dashboard.value?.counters
  return [
    { label: 'Times', icon: 'mdi-shield', color: 'primary', value: c?.teams ?? '—' },
    { label: 'Partidas', icon: 'mdi-soccer-field', color: 'info', value: c?.games ?? '—' },
    { label: 'Estádios', icon: 'mdi-stadium', color: 'secondary', value: c?.stadiums ?? '—' },
    { label: 'Temporada', icon: 'mdi-calendar', color: 'success', value: c?.season || '—' },
  ]
})

const goalsTitle = computed(() => {
  const buckets = dashboard.value?.goals_by_bucket ?? []
  const hasRounds = buckets.some((b) => b.type === 'round')
  const hasPhases = buckets.some((b) => b.type === 'phase')
  if (hasRounds && hasPhases) return 'Gols por rodada/fase'
  return hasPhases ? 'Gols por fase' : 'Gols por rodada'
})

const leagueFacts = computed(() =>
  [
    league.value?.organizer ? `Organizado por ${league.value.organizer}` : null,
    league.value?.format ? LEAGUE_FORMAT_LABELS[league.value.format] : null,
  ].filter(Boolean),
)

/**
 * Total de cartões da liga. O endpoint de Dashboard não traz esse total, e `top_cards`
 * das estatísticas é limitado ao top 10 de jogadores — então contamos os eventos de
 * cartão (GET /game-events?type=, já escopado às ligas do usuário) desta liga.
 */
async function fetchCards(): Promise<CardsSplit> {
  const [yellow, red] = await Promise.all([
    gameEventsService.list({ type: 'yellow_card' }),
    gameEventsService.list({ type: 'red_card' }),
  ])
  return {
    yellow: yellow.filter((event) => event.league_id === leagueId).length,
    red: red.filter((event) => event.league_id === leagueId).length,
  }
}

async function load() {
  loading.value = true
  errorMessage.value = null
  const [dashboardResult, cardsResult] = await Promise.allSettled([
    leaguesService.dashboard(leagueId),
    fetchCards(),
  ])
  loading.value = false

  if (dashboardResult.status === 'rejected') {
    const err = dashboardResult.reason as AxiosError<ApiErrorResponse>
    errorMessage.value = err.response?.data?.message ?? 'Não foi possível carregar o Dashboard.'
    return
  }

  snapshot.value = {
    dashboard: dashboardResult.value,
    cards: cardsResult.status === 'fulfilled' ? cardsResult.value : null,
  }
  leagueContext.dashboardCache.set(leagueId, snapshot.value)
}

onMounted(load)
</script>

<template>
  <div :class="{ 'is-refreshing': loading && dashboard }">
    <v-card v-if="league" class="hero mb-6 pa-2" data-test="dashboard-header">
      <v-card-text class="d-flex flex-wrap align-center ga-4">
        <v-avatar color="primary" size="56" rounded="lg">
          <v-img v-if="league.championship?.image" :src="league.championship.image" cover />
          <v-icon v-else icon="mdi-trophy" size="28" />
        </v-avatar>
        <div class="flex-grow-1">
          <h1 class="text-h5 font-weight-bold">{{ league.name }}</h1>
          <p class="text-medium-emphasis">
            {{ league.championship?.name }}<template v-for="fact in leagueFacts" :key="fact"> · {{ fact }}</template>
          </p>
        </div>
        <v-btn variant="outlined" size="small" :to="{ name: 'admin-league-table' }">Ver tabela</v-btn>
      </v-card-text>
    </v-card>

    <v-alert v-if="errorMessage" type="error" class="mb-4">{{ errorMessage }}</v-alert>

    <v-row v-if="loading && !dashboard" justify="center" class="py-8">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <template v-else-if="dashboard">
      <v-row class="mb-2">
        <v-col v-for="counter in counters" :key="counter.label" cols="6" md="3">
          <StatCard
            :icon="counter.icon"
            :label="counter.label"
            :value="counter.value"
            :color="counter.color"
            data-test="dashboard-counter"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="7">
          <v-card class="h-100">
            <v-card-title class="text-subtitle-1 font-weight-bold">{{ goalsTitle }}</v-card-title>
            <v-card-text>
              <GoalsBarChart :buckets="dashboard.goals_by_bucket" />
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card class="mb-4">
            <v-card-title class="text-subtitle-1 font-weight-bold">Resultados</v-card-title>
            <v-card-text>
              <ResultsSplitBar :split="dashboard.results_split" />
            </v-card-text>
          </v-card>
          <v-card>
            <v-card-title class="text-subtitle-1 font-weight-bold">Cartões</v-card-title>
            <v-card-text>
              <CardsBarChart v-if="snapshot?.cards" :cards="snapshot.cards" />
              <div v-else class="text-medium-emphasis text-body-2">
                Não foi possível carregar os cartões desta liga.
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-2">
        <v-col cols="12" md="6">
          <h2 class="text-subtitle-1 font-weight-bold mb-2">Últimos resultados</h2>
          <GameMiniList :games="dashboard.last_results" empty-message="Nenhuma partida finalizada ainda." />
        </v-col>
        <v-col cols="12" md="6">
          <h2 class="text-subtitle-1 font-weight-bold mb-2">Próximas partidas</h2>
          <GameMiniList :games="dashboard.upcoming_games" empty-message="Nenhuma partida agendada." />
        </v-col>
      </v-row>
    </template>
  </div>
</template>

<style scoped>
.hero {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.1),
    rgb(var(--v-theme-surface)) 65%
  );
}
/* Revalidação mantém o último render, só esmaecido — sem esqueleto nem salto de layout. */
.is-refreshing :deep(.v-row) {
  opacity: 0.6;
  transition: opacity 0.15s;
}
</style>
