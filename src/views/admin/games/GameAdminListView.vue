<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useCrud } from '@/composables/useCrud'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { gamesService } from '@/services/api/games.service'
import { leaguesService } from '@/services/api/leagues.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import { teamsService } from '@/services/api/teams.service'
import {
  formatMatchDate,
  GAME_STATUS_OPTIONS,
  gameStageLabel,
  gameStatusOption,
  knownPhasesOf,
  scoreLabel,
} from '@/types/game'
import type { Game, GameListParams, GamePayload, GameStatus, KnownPhase } from '@/types/game'
import type { Stadium } from '@/types/stadium'
import type { Team } from '@/types/team'
import PageHeader from '@/components/common/PageHeader.vue'
import GameFormDialog from '@/components/games/GameFormDialog.vue'

interface GameFilters {
  round: string | number | null
  phase: string | null
  status: GameStatus | null
  team_id: number | null
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PER_PAGE = 20

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const route = useRoute()
const router = useRouter()
const { xs, smAndDown } = useDisplay()
const { items, meta, loading, errorMessage, fetchPage } = useCrud<Game, GamePayload>(gamesService)

const leagueId = leagueContext.activeLeagueId as number
const league = leagueContext.activeLeague
const isDrawLeague = league?.fixture_mode === 'draw'
const canCreate = authStore.hasPermission('game:create') && !isDrawLeague
const drawNotice =
  league?.format === 'hybrid'
    ? 'As partidas de rodada desta liga são criadas pelo sorteio e as de mata-mata são geradas pela classificação.'
    : 'As partidas de rodada desta liga são criadas pelo sorteio.'
const showRoundFilter = league?.format !== 'knockout'

const teams = ref<Team[]>([])
const stadiums = ref<Stadium[]>([])
const knownPhases = ref<KnownPhase[]>([])
const formDialog = ref(false)

function queryValue(query: LocationQuery, key: string): string | null {
  const value = query[key]
  return typeof value === 'string' && value !== '' ? value : null
}

function positiveInt(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null
}

function filtersFromQuery(query: LocationQuery): GameFilters {
  const status = queryValue(query, 'status')
  return {
    round: showRoundFilter ? positiveInt(queryValue(query, 'round')) : null,
    phase: queryValue(query, 'phase'),
    status: GAME_STATUS_OPTIONS.some((option) => option.value === status)
      ? (status as GameStatus)
      : null,
    team_id: positiveInt(queryValue(query, 'team_id')),
  }
}

const perPageFromQuery = positiveInt(queryValue(route.query, 'per_page'))

const appliedFilters = ref<GameFilters>(filtersFromQuery(route.query))
const draftFilters = ref<GameFilters>({ ...appliedFilters.value })
const roundError = ref<string | null>(null)
const page = ref(positiveInt(queryValue(route.query, 'page')) ?? 1)
const perPage = ref(
  perPageFromQuery && PER_PAGE_OPTIONS.includes(perPageFromQuery)
    ? perPageFromQuery
    : DEFAULT_PER_PAGE,
)

const teamOptions = computed(() =>
  teams.value.map((team) => ({ value: team.id, title: team.nickname || team.name })),
)
const phaseOptions = computed(() => knownPhases.value.map((item) => item.phase))
const hasAppliedFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => isFilled(value)),
)

function isFilled(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function buildQuery(filters: GameFilters, targetPage: number): GameListParams {
  const params: GameListParams = { league_id: leagueId, page: targetPage, per_page: perPage.value }
  if (isFilled(filters.round)) params.round = Number(filters.round)
  if (filters.phase) params.phase = filters.phase
  if (filters.status) params.status = filters.status
  if (filters.team_id) params.team_id = filters.team_id
  return params
}

const query = computed(() => buildQuery(appliedFilters.value, page.value))

function routeQuery(params: GameListParams): Record<string, string> {
  const result: Record<string, string> = {}
  if (params.round) result.round = String(params.round)
  if (params.phase) result.phase = params.phase
  if (params.status) result.status = params.status
  if (params.team_id) result.team_id = String(params.team_id)
  if (params.page && params.page > 1) result.page = String(params.page)
  if (params.per_page !== DEFAULT_PER_PAGE) result.per_page = String(params.per_page)
  return result
}

watch(
  () => JSON.stringify(query.value),
  () => {
    fetchPage(query.value)
    router.replace({ query: routeQuery(query.value) })
  },
  { immediate: true },
)

function teamName(id: number): string {
  const team = teams.value.find((t) => t.id === id)
  return team?.nickname || team?.name || '—'
}

const rows = computed(() =>
  items.value.map((game) => ({
    ...game,
    stage: gameStageLabel(game),
    home: game.homeTeam?.nickname || game.homeTeam?.name || teamName(game.home_team_id),
    away: game.awayTeam?.nickname || game.awayTeam?.name || teamName(game.away_team_id),
  })),
)

function searchGames() {
  const round = draftFilters.value.round
  if (isFilled(round) && !(Number.isInteger(Number(round)) && Number(round) >= 1)) {
    roundError.value = 'Informe uma rodada válida (número inteiro a partir de 1).'
    return
  }
  roundError.value = null
  const next = { ...draftFilters.value }
  if (JSON.stringify(buildQuery(next, 1)) === JSON.stringify(query.value)) {
    fetchPage(query.value)
    return
  }
  appliedFilters.value = next
  page.value = 1
}

function loadPhases() {
  if (league?.format === 'round_robin') return
  leaguesService
    .table(leagueId)
    .then((table) => (knownPhases.value = knownPhasesOf(table)))
    .catch(() => (knownPhases.value = []))
}

const headers = computed(() => [
  ...(smAndDown.value ? [] : [{ title: 'Etapa', key: 'stage', sortable: false }]),
  { title: 'Confronto', key: 'matchup', sortable: false },
  ...(xs.value ? [] : [{ title: 'Placar', key: 'score', sortable: false, align: 'center' as const }]),
  ...(smAndDown.value
    ? []
    : [
        { title: 'Data', key: 'match_date', sortable: false },
        { title: 'Status', key: 'status', sortable: false },
      ]),
  {
    title: '',
    key: 'actions',
    sortable: false,
    align: 'end' as const,
    headerProps: { class: 'px-2' },
    cellProps: { class: 'px-2' },
  },
])

function score(game: Game): string {
  return scoreLabel(game)
}

function gameRoute(game: Game) {
  return { name: 'admin-games-detail', params: { leagueId, id: game.id } }
}

function openGame(_event: Event, row: { item: Game }) {
  router.push(gameRoute(row.item))
}

function onCreated(game: Game) {
  router.push(gameRoute(game))
}

onMounted(() => {
  teamsService.list({ league_id: leagueId }).then((data) => (teams.value = data)).catch(() => undefined)
  if (canCreate) {
    stadiumsService.list({ league_id: leagueId }).then((data) => (stadiums.value = data)).catch(() => undefined)
  }
  loadPhases()
})
</script>

<template>
  <div>
    <PageHeader title="Partidas" :subtitle="league?.name">
      <template #action>
        <v-btn
          v-if="canCreate"
          color="primary"
          prepend-icon="mdi-plus"
          data-test="game-create"
          @click="formDialog = true"
        >
          <span class="d-none d-sm-inline">Nova partida</span>
          <span class="d-sm-none">Nova</span>
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-alert
      v-if="isDrawLeague"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      data-test="games-draw-notice"
    >
      <div class="d-flex flex-wrap align-center ga-2">
        <span class="flex-1-1-0">{{ drawNotice }}</span>
        <v-btn
          size="small"
          variant="text"
          color="primary"
          append-icon="mdi-arrow-right"
          :to="{ name: 'admin-league-draw', params: { leagueId } }"
          data-test="games-draw-link"
        >
          Ir para o sorteio
        </v-btn>
      </div>
    </v-alert>

    <v-card>
      <v-card-text>
        <v-row dense class="mb-2">
          <v-col v-if="showRoundFilter" cols="12" sm="6" md>
            <v-text-field
              v-model="draftFilters.round"
              type="number"
              min="1"
              label="Rodada"
              hide-details="auto"
              clearable
              :error-messages="roundError ?? undefined"
              data-test="game-round-filter"
              @keyup.enter="searchGames"
            />
          </v-col>
          <v-col v-if="phaseOptions.length > 0" cols="12" sm="6" md>
            <v-select
              v-model="draftFilters.phase"
              :items="phaseOptions"
              label="Fase"
              hide-details
              clearable
              data-test="game-phase-filter"
            />
          </v-col>
          <v-col cols="12" sm="6" md>
            <v-select
              v-model="draftFilters.status"
              :items="GAME_STATUS_OPTIONS"
              item-title="title"
              item-value="value"
              label="Status"
              hide-details
              clearable
              data-test="game-status-filter"
            />
          </v-col>
          <v-col cols="12" sm="6" md>
            <v-autocomplete
              v-model="draftFilters.team_id"
              :items="teamOptions"
              label="Time"
              hide-details
              clearable
              data-test="game-team-filter"
            />
          </v-col>
          <v-col cols="12" sm="auto" class="d-flex align-center">
            <v-btn
              color="primary"
              prepend-icon="mdi-magnify"
              :block="xs"
              :loading="loading"
              data-test="game-search"
              @click="searchGames"
            >
              Buscar
            </v-btn>
          </v-col>
        </v-row>
        <v-data-table-server
          v-model:page="page"
          v-model:items-per-page="perPage"
          :headers="headers"
          :items="rows"
          :items-length="meta?.total ?? 0"
          :items-per-page-options="PER_PAGE_OPTIONS"
          :loading="loading"
          item-value="id"
          :no-data-text="
            hasAppliedFilters
              ? 'Nenhuma partida encontrada com esses filtros.'
              : 'Nenhuma partida cadastrada nesta liga.'
          "
          hover
          data-test="games-table"
          @click:row="openGame"
        >
          <template v-slot:[`item.matchup`]="{ item }">
            <div class="d-flex align-center ga-3 py-2">
              <div class="flex-grow-1 min-w-0">
                <div class="font-weight-medium">
                  {{ item.home }} <span class="text-medium-emphasis">×</span> {{ item.away }}
                </div>
                <div v-if="smAndDown" class="text-caption text-medium-emphasis">
                  {{ item.stage }} · {{ formatMatchDate(item.match_date) }} · {{ gameStatusOption(item.status).title }}
                </div>
              </div>
              <strong v-if="xs" class="tabular text-no-wrap">{{ score(item) }}</strong>
            </div>
          </template>
          <template v-slot:[`item.score`]="{ item }">
            <strong class="tabular">{{ score(item) }}</strong>
          </template>
          <template v-slot:[`item.match_date`]="{ item }">{{ formatMatchDate(item.match_date) }}</template>
          <template v-slot:[`item.status`]="{ item }">
            <v-chip :color="gameStatusOption(item.status).color" size="small" variant="tonal">
              {{ gameStatusOption(item.status).title }}
            </v-chip>
          </template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-eye-outline"
              variant="text"
              size="small"
              :to="gameRoute(item)"
              :aria-label="`Ver partida ${item.home} × ${item.away}`"
              data-test="game-view"
              @click.stop
            />
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <GameFormDialog
      v-if="canCreate"
      v-model="formDialog"
      :league-id="leagueId"
      :format="league?.format"
      :teams="teams"
      :stadiums="stadiums"
      :known-phases="knownPhases"
      :fixture-mode="league?.fixture_mode"
      @saved="onCreated"
    />
  </div>
</template>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}
.min-w-0 {
  min-width: 0;
}
</style>
