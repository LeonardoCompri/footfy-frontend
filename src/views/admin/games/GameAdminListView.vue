<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { gamesService } from '@/services/api/games.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import { teamsService } from '@/services/api/teams.service'
import { formatMatchDate, gameStageLabel, gameStatusOption } from '@/types/game'
import type { Game, GamePayload } from '@/types/game'
import type { Stadium } from '@/types/stadium'
import type { Team } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import GameFormDialog from '@/components/games/GameFormDialog.vue'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const router = useRouter()
const snackbar = useSnackbar()
const { xs, smAndDown } = useDisplay()
const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Game, GamePayload>(gamesService)

// Lista escopada pela Liga ativa (o layout remonta a tela ao trocar de liga).
const leagueId = leagueContext.activeLeagueId as number
const league = leagueContext.activeLeague
const can = {
  create: authStore.hasPermission('game:create'),
  update: authStore.hasPermission('game:update'),
  delete: authStore.hasPermission('game:delete'),
}

const teams = ref<Team[]>([])
const stadiums = ref<Stadium[]>([])
const search = ref('')
const stageFilter = ref<string | null>(null)
const formDialog = ref(false)
const gameToEdit = ref<Game | null>(null)
const { open: confirmOpen, target: gameToDelete, ask: askDelete } = useConfirmDialog<Game>()

function teamName(id: number): string {
  const team = teams.value.find((t) => t.id === id)
  return team?.nickname || team?.name || '—'
}

// Ordem do calendário: rodadas, depois fases do mata-mata (por ordem), depois data.
function stageOrder(game: Game): number {
  if (game.round != null) return game.round
  return 10_000 + (game.phase_order ?? 999)
}

const rows = computed(() =>
  [...items.value]
    .sort((a, b) => stageOrder(a) - stageOrder(b) || (a.match_date ?? '').localeCompare(b.match_date ?? ''))
    .map((game) => ({
      ...game,
      stage: gameStageLabel(game),
      stageGroup: game.round != null ? `${game.round}ª rodada` : (game.phase ?? '—'),
      home: teamName(game.home_team_id),
      away: teamName(game.away_team_id),
    })),
)

const stageOptions = computed(() => [...new Set(rows.value.map((row) => row.stageGroup))])

const filteredRows = computed(() => {
  const term = search.value?.trim().toLocaleLowerCase('pt-BR') ?? ''
  return rows.value.filter(
    (row) =>
      (!stageFilter.value || row.stageGroup === stageFilter.value) &&
      (!term || `${row.home} ${row.away}`.toLocaleLowerCase('pt-BR').includes(term)),
  )
})

const knownPhases = computed(() =>
  items.value
    .filter((game) => game.phase)
    .map((game) => ({ phase: game.phase as string, phase_order: game.phase_order })),
)

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
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir a partida.')
    errorMessage.value = null
  }
  gameToDelete.value = null
}

function onSaved(game: Game) {
  if (gameToEdit.value) {
    fetchAll({ league_id: leagueId })
  } else {
    router.push({ name: 'admin-games-detail', params: { id: game.id } })
  }
}

onMounted(() => {
  fetchAll({ league_id: leagueId })
  teamsService.list({ league_id: leagueId }).then((data) => (teams.value = data)).catch(() => undefined)
  if (can.create || can.update) {
    stadiumsService.list({ league_id: leagueId }).then((data) => (stadiums.value = data)).catch(() => undefined)
  }
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
          <v-col cols="12" sm="7">
            <v-text-field
              v-model="search"
              prepend-inner-icon="mdi-magnify"
              label="Buscar time"
              single-line
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" sm="5">
            <v-select
              v-model="stageFilter"
              :items="stageOptions"
              label="Rodada/fase"
              single-line
              hide-details
              clearable
              data-test="game-stage-filter"
            />
          </v-col>
        </v-row>
        <v-data-table
          :headers="headers"
          :items="filteredRows"
          :loading="loading"
          item-value="id"
          :items-per-page="20"
          no-data-text="Nenhuma partida cadastrada nesta liga."
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
        </v-data-table>
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
