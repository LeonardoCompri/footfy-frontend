<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { extractErrorMessage, useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { teamsService } from '@/services/api/teams.service'
import type { Game } from '@/types/game'
import type { GameEvent, GameEventPayload, SummaryTeam } from '@/types/gameEvent'
import { useChartPalette } from '@/components/charts/chartPalette'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import GameEventFormDialog from './GameEventFormDialog.vue'

const props = defineProps<{ game: Game }>()

const authStore = useAuthStore()
const snackbar = useSnackbar()
const palette = useChartPalette()
const { items: events, loading, errorMessage, fetchAll, destroy } = useCrud<GameEvent, GameEventPayload>(
  gameEventsService,
)

const can = {
  create: authStore.hasPermission('game_event:create'),
  update: authStore.hasPermission('game_event:update'),
  delete: authStore.hasPermission('game_event:delete'),
}

const teams = ref<SummaryTeam[]>([])
const playersError = ref<string | null>(null)
const formDialog = ref(false)
const eventToEdit = ref<GameEvent | null>(null)
const { open: confirmOpen, target: eventToDelete, ask: askDelete } = useConfirmDialog<GameEvent>()

// Minuto em ordem crescente; eventos sem minuto vão para o fim, na ordem de registro.
const timeline = computed(() =>
  [...events.value].sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity) || a.id - b.id),
)

const goalsByTeam = computed(() => {
  const goals = events.value.filter((event) => event.type === 'goal')
  return {
    home: goals.filter((event) => event.team_id === props.game.home_team_id).length,
    away: goals.filter((event) => event.team_id === props.game.away_team_id).length,
  }
})

// Aviso (não bloqueia): placar finalizado diferente dos gols lançados na súmula.
const scoreMismatch = computed(
  () =>
    props.game.status === 'finished' &&
    props.game.home_score !== null &&
    props.game.away_score !== null &&
    (goalsByTeam.value.home !== props.game.home_score || goalsByTeam.value.away !== props.game.away_score),
)

const eventMeta = computed(() => ({
  goal: { icon: 'mdi-soccer', color: undefined, label: 'Gol' },
  yellow_card: { icon: 'mdi-card', color: palette.value.yellowCard, label: 'Cartão amarelo' },
  red_card: { icon: 'mdi-card', color: palette.value.redCard, label: 'Cartão vermelho' },
}))

function teamName(teamId: number): string {
  return teams.value.find((team) => team.id === teamId)?.name ?? '—'
}

function playerName(playerId: number | null): string {
  if (!playerId) return '—'
  for (const team of teams.value) {
    const player = team.players.find((p) => p.id === playerId)
    if (player) return player.name
  }
  return 'Jogador fora do elenco'
}

function eventSubtitle(event: GameEvent): string {
  const parts = [eventMeta.value[event.type].label, teamName(event.team_id)]
  if (event.related_player_id) parts.push(`Assistência: ${playerName(event.related_player_id)}`)
  return parts.join(' · ')
}

function openForm(event: GameEvent | null) {
  eventToEdit.value = event
  formDialog.value = true
}

// Atualiza a lista local com a resposta do backend, sem refazer o GET.
function onSaved(saved: GameEvent) {
  const index = events.value.findIndex((event) => event.id === saved.id)
  if (index === -1) events.value.push(saved)
  else events.value[index] = saved
}

async function handleDelete() {
  if (!eventToDelete.value) return
  if (await destroy(eventToDelete.value.id)) {
    snackbar.success('Evento excluído com sucesso.')
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir o evento.')
    errorMessage.value = null
  }
  eventToDelete.value = null
}

// Elenco elegível = só os dois times da partida (GET /teams/{id} já traz os jogadores).
async function loadTeams() {
  try {
    const [home, away] = await Promise.all([
      teamsService.get(props.game.home_team_id),
      teamsService.get(props.game.away_team_id),
    ])
    teams.value = [home, away].map((team) => ({
      id: team.id,
      name: team.nickname || team.name,
      players: [...(team.players ?? [])].sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
    }))
  } catch (err) {
    playersError.value = extractErrorMessage(err)
  }
}

onMounted(() => {
  fetchAll({ game_id: props.game.id })
  loadTeams()
})
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <span class="text-subtitle-1 font-weight-bold">Súmula</span>
      <v-spacer />
      <v-btn
        v-if="can.create"
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        :disabled="teams.length === 0"
        data-test="event-create"
        @click="openForm(null)"
      >
        Evento
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>
      <v-alert v-if="playersError" type="warning" variant="tonal" class="mb-4">
        Não foi possível carregar os elencos: {{ playersError }}
      </v-alert>
      <v-alert v-if="scoreMismatch" type="info" variant="tonal" density="compact" class="mb-4" data-test="score-mismatch">
        Gols na súmula ({{ goalsByTeam.home }} × {{ goalsByTeam.away }}) diferem do placar da partida
        ({{ game.home_score }} × {{ game.away_score }}).
      </v-alert>

      <div v-if="loading && events.length === 0" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <div v-else-if="timeline.length === 0" class="text-medium-emphasis text-center py-6" data-test="events-empty">
        Nenhum evento registrado nesta partida.
      </div>
      <v-list v-else lines="two" class="pa-0" data-test="events-list">
        <v-list-item v-for="event in timeline" :key="event.id" class="px-0" data-test="event-row">
          <template #prepend>
            <div class="minute text-medium-emphasis tabular">{{ event.minute != null ? `${event.minute}'` : '—' }}</div>
            <v-icon
              :icon="eventMeta[event.type].icon"
              :color="eventMeta[event.type].color"
              :aria-label="eventMeta[event.type].label"
              class="mr-3"
            />
          </template>
          <v-list-item-title>{{ playerName(event.player_id) }}</v-list-item-title>
          <v-list-item-subtitle>{{ eventSubtitle(event) }}</v-list-item-subtitle>
          <template v-if="can.update || can.delete" #append>
            <v-btn
              v-if="can.update"
              icon="mdi-pencil"
              variant="text"
              size="small"
              :disabled="teams.length === 0"
              data-test="event-edit"
              @click="openForm(event)"
            />
            <v-btn
              v-if="can.delete"
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              data-test="event-delete"
              @click="askDelete(event)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>

    <GameEventFormDialog
      v-model="formDialog"
      :game-id="game.id"
      :teams="teams"
      :event="eventToEdit"
      @saved="onSaved"
    />
    <ConfirmDialog
      v-model="confirmOpen"
      title="Excluir evento"
      message="Tem certeza que deseja excluir este evento da súmula?"
      @confirm="handleDelete"
    />
  </v-card>
</template>

<style scoped>
.minute {
  width: 36px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
