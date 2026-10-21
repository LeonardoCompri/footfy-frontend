<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
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
} from '@/types/game'
import type { Game, GameListParams, GamePayload, GameStatus } from '@/types/game'
import type { Stadium } from '@/types/stadium'
import type { Team } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import GameFormDialog from '@/components/games/GameFormDialog.vue'

interface GameFilters {
  round: string | number | null
  phase: string | null
  status: GameStatus | null
  team_id: number | null
}

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const router = useRouter()
const snackbar = useSnackbar()
const { xs, smAndDown } = useDisplay()
const { items, meta, loading, errorMessage, fetchPage, destroy } = useCrud<Game, GamePayload>(
  gamesService,
)

// Lista escopada pela Liga ativa (o layout remonta a tela ao trocar de liga).
const leagueId = leagueContext.activeLeagueId as number
const league = leagueContext.activeLeague
const can = {
  create: authStore.hasPermission('game:create'),
  update: authStore.hasPermission('game:update'),
  delete: authStore.hasPermission('game:delete'),
}
const showRoundFilter = league?.format !== 'knockout'

const teams = ref<Team[]>([])
const stadiums = ref<Stadium[]>([])
const knownPhases = ref<{ phase: string; phase_order: number | null }[]>([])
const formDialog = ref(false)
const gameToEdit = ref<Game | null>(null)
const { open: confirmOpen, target: gameToDelete, ask: askDelete } = useConfirmDialog<Game>()

const emptyFilters = (): GameFilters => ({ round: null, phase: null, status: null, team_id: null })
// Os campos editam só o rascunho; a API só recebe os filtros aplicados pelo botão "Buscar".
const draftFilters = ref<GameFilters>(emptyFilters())
const appliedFilters = ref<GameFilters>(emptyFilters())
const roundError = ref<string | null>(null)
const page = ref(1)
const perPage = ref(20)

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

// Única fonte de requisição da lista (inclusive no mount). A comparação por JSON ignora disparos
// sem mudança real; não usamos @update:options porque o Vuetify o emite também ao montar.
watch(
  () => JSON.stringify(query.value),
  () => fetchPage(query.value),
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
  // Mesmos filtros já na página 1: o watcher não dispararia, então recarrega direto.
  if (JSON.stringify(buildQuery(next, 1)) === JSON.stringify(query.value)) {
    fetchPage(query.value)
    return
  }
  appliedFilters.value = next
  page.value = 1
}

// Fases do mata-mata (opções do filtro e fases conhecidas do formulário). O mesmo nome pode repetir.
function loadPhases() {
  if (league?.format === 'round_robin') return
  leaguesService
    .table(leagueId)
    .then((table) => {
      const unique = new Map<string, { phase: string; phase_order: number | null }>()
      for (const item of table.phases ?? []) {
        if (unique.has(item.phase)) continue
        unique.set(item.phase, { phase: item.phase, phase_order: item.phase_order })
      }
      knownPhases.value = [...unique.values()]
    })
    .catch(() => (knownPhases.value = []))
}

// No mobile Etapa/Data/Status viram legenda sob o confronto, para caber sem rolagem horizontal.
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
  ...(can.update || can.delete ? [{ title: '', key: 'actions', sortable: false, align: 'end' as const }] : []),
])

function score(game: Game): string {
  if (game.home_score === null || game.away_score === null) return '—'
  return `${game.home_score} × ${game.away_score}`
}

function openGame(_event: Event, row: { item: Game }) {
  router.push({ name: 'admin-games-detail', params: { id: row.item.id } })
}

function openForm(game: Game | null) {
  gameToEdit.value = game
  formDialog.value = true
}

async function handleDelete() {
  if (!gameToDelete.value) return
  if (await destroy(gameToDelete.value.id)) {
    snackbar.success('Partida excluída com sucesso.')
    // Página esvaziou: volta uma (o watcher recarrega); senão recarrega para repor a página.
    if (items.value.length === 0 && page.value > 1) page.value--
    else fetchPage(query.value)
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir a partida.')
    errorMessage.value = null
  }
  gameToDelete.value = null
}

function onSaved(game: Game) {
  if (gameToEdit.value) {
    fetchPage(query.value)
    loadPhases()
  } else {
    router.push({ name: 'admin-games-detail', params: { id: game.id } })
  }
}

onMounted(() => {
  teamsService.list({ league_id: leagueId }).then((data) => (teams.value = data)).catch(() => undefined)
  if (can.create || can.update) {
    stadiumsService.list({ league_id: leagueId }).then((data) => (stadiums.value = data)).catch(() => undefined)
  }
  loadPhases()
})
</script>

<template>
  <div>
    <PageHeader title="Partidas" :subtitle="league?.name">
      <template #action>
        <v-btn v-if="can.create" color="primary" prepend-icon="mdi-plus" data-test="game-create" @click="openForm(null)">
          <span class="d-none d-sm-inline">Nova partida</span>
          <span class="d-sm-none">Nova</span>
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

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
          :items-per-page-options="[10, 20, 50, 100]"
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
            <div class="d-flex justify-end">
              <v-btn
                v-if="can.update"
                icon="mdi-pencil"
                variant="text"
                size="small"
                data-test="game-edit"
                @click.stop="openForm(item)"
              />
              <v-btn
                v-if="can.delete"
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                data-test="game-delete"
                @click.stop="askDelete(item)"
              />
            </div>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <GameFormDialog
      v-model="formDialog"
      :league-id="leagueId"
      :format="league?.format"
      :teams="teams"
      :stadiums="stadiums"
      :game="gameToEdit"
      :known-phases="knownPhases"
      @saved="onSaved"
    />
    <ConfirmDialog
      v-model="confirmOpen"
      title="Excluir partida"
      message="Excluir a partida remove também todos os eventos da súmula. Deseja continuar?"
      @confirm="handleDelete"
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
