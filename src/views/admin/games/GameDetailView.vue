<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBackLink } from '@/composables/useBackLink'
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
  GAME_LEG_OPTIONS,
  gameStageLabel,
  gameStatusOption,
  knownPhasesOf,
} from '@/types/game'
import type { Game, GamePayload, KnownPhase } from '@/types/game'
import type { Stadium } from '@/types/stadium'
import type { Team } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import QueryTabs from '@/components/common/QueryTabs.vue'
import GameEventsPanel from '@/components/games/GameEventsPanel.vue'
import GameFormDialog from '@/components/games/GameFormDialog.vue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const { errorMessage, fetchOne, destroy } = useCrud<Game, GamePayload>(gamesService)

const leagueId = leagueContext.activeLeagueId as number
const league = leagueContext.activeLeague
const can = {
  update: authStore.hasPermission('game:update'),
  delete: authStore.hasPermission('game:delete'),
}

const game = ref<Game | null>(null)
const initializing = ref(true)
const teams = ref<Team[]>([])
const stadiums = ref<Stadium[]>([])
const knownPhases = ref<KnownPhase[]>([])
const editDialog = ref(false)
const deleteDialog = ref(false)

const listRoute = useBackLink({ name: 'admin-games-list', params: { leagueId } })

const tabs = [
  { value: 'detalhes', title: 'Detalhes do confronto' },
  { value: 'sumula', title: 'Súmula' },
]

const homeName = computed(() => game.value?.homeTeam?.nickname || game.value?.homeTeam?.name || 'Mandante')
const awayName = computed(() => game.value?.awayTeam?.nickname || game.value?.awayTeam?.name || 'Visitante')
const status = computed(() => (game.value ? gameStatusOption(game.value.status) : null))
const hasScore = computed(() => game.value?.home_score != null && game.value?.away_score != null)

const details = computed(() => {
  const g = game.value
  if (!g) return []
  const usesPhase = g.round == null && !!g.phase
  return [
    { icon: 'mdi-flag-checkered', label: usesPhase ? 'Fase' : 'Rodada', value: usesPhase ? g.phase : g.round ? `${g.round}ª rodada` : '—' },
    ...(usesPhase
      ? [
          { icon: 'mdi-tournament', label: 'Confronto', value: g.tie_key || '—' },
          { icon: 'mdi-swap-horizontal', label: 'Perna', value: GAME_LEG_OPTIONS.find((o) => o.value === g.leg)?.title ?? 'Jogo único' },
        ]
      : []),
    { icon: 'mdi-calendar', label: 'Data e hora', value: formatMatchDate(g.match_date) },
    { icon: 'mdi-stadium', label: 'Estádio', value: g.stadium?.name ? `${g.stadium.name} · ${g.stadium.city}` : '—' },
    { icon: 'mdi-information-outline', label: 'Status', value: gameStatusOption(g.status).title },
  ]
})

async function loadGame() {
  const data = await fetchOne(props.id)
  if (data) game.value = data
}

function loadKnownPhases(): Promise<KnownPhase[]> {
  if (league?.format === 'round_robin') return Promise.resolve([])
  return leaguesService
    .table(leagueId)
    .then(knownPhasesOf)
    .catch(() => [])
}

async function openEdit() {
  if (teams.value.length === 0) {
    const phases = loadKnownPhases()
    const [leagueTeams, leagueStadiums] = await Promise.all([
      teamsService.list({ league_id: leagueId }),
      stadiumsService.list({ league_id: leagueId }),
    ]).catch(() => [[], []] as [Team[], Stadium[]])
    teams.value = leagueTeams
    stadiums.value = leagueStadiums
    knownPhases.value = await phases
  }
  editDialog.value = true
}

async function handleDelete() {
  if (!game.value) return
  if (await destroy(game.value.id)) {
    snackbar.success('Partida excluída com sucesso.')
    router.push(listRoute)
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir a partida.')
    errorMessage.value = null
  }
}

onMounted(async () => {
  try {
    await loadGame()
  } finally {
    initializing.value = false
  }
})
</script>

<template>
  <div>
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-2"
      :to="listRoute"
      data-test="back-to-games"
    >
      Partidas
    </v-btn>

    <div v-if="initializing" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="!game" type="error" variant="tonal">
      {{ errorMessage ?? 'Partida não encontrada.' }}
    </v-alert>

    <template v-else>
      <v-card class="mb-4" data-test="game-header">
        <v-card-text>
          <div class="d-flex flex-wrap align-center ga-2 mb-4">
            <span class="text-medium-emphasis">{{ gameStageLabel(game) }}</span>
            <v-chip v-if="status" :color="status.color" size="small" variant="tonal">{{ status.title }}</v-chip>
            <v-spacer />
            <v-btn
              v-if="can.update"
              variant="tonal"
              size="small"
              prepend-icon="mdi-pencil"
              data-test="game-edit"
              @click="openEdit"
            >
              Editar
            </v-btn>
            <v-btn
              v-if="can.delete"
              variant="tonal"
              size="small"
              color="error"
              prepend-icon="mdi-delete"
              data-test="game-delete"
              @click="deleteDialog = true"
            >
              Excluir
            </v-btn>
          </div>

          <div class="scoreboard">
            <div class="team text-end">
              <div class="text-h6 text-sm-h5 font-weight-bold text-break">{{ homeName }}</div>
              <div class="text-caption text-medium-emphasis">Mandante</div>
            </div>
            <div class="text-h4 font-weight-bold tabular text-no-wrap" data-test="game-score">
              <template v-if="hasScore">{{ game.home_score }} × {{ game.away_score }}</template>
              <span v-else class="text-medium-emphasis">×</span>
            </div>
            <div class="team">
              <div class="text-h6 text-sm-h5 font-weight-bold text-break">{{ awayName }}</div>
              <div class="text-caption text-medium-emphasis">Visitante</div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <QueryTabs :tabs="tabs">
        <template #detalhes>
          <v-card>
            <v-list lines="two" data-test="game-details">
              <v-list-item
                v-for="field in details"
                :key="field.label"
                :prepend-icon="field.icon"
                :title="String(field.value)"
                :subtitle="field.label"
              />
            </v-list>
          </v-card>
        </template>
        <template #sumula>
          <GameEventsPanel
            :key="`${game.home_team_id}-${game.away_team_id}`"
            :game="game"
            @changed="loadGame"
          />
        </template>
      </QueryTabs>

      <GameFormDialog
        v-model="editDialog"
        :league-id="leagueId"
        :format="league?.format"
        :teams="teams"
        :stadiums="stadiums"
        :game="game"
        :known-phases="knownPhases"
        @saved="loadGame"
      />
      <ConfirmDialog
        v-model="deleteDialog"
        title="Excluir partida"
        message="Excluir a partida remove também todos os eventos da súmula. Deseja continuar?"
        @confirm="handleDelete"
      />
    </template>
  </div>
</template>

<style scoped>
.scoreboard {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
}
.team {
  min-width: 0;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
