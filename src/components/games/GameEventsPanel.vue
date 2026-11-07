<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useEventTypesStore } from '@/stores/eventTypes'
import { gameEventsService } from '@/services/api/gameEvents.service'
import type { Game } from '@/types/game'
import type { Team } from '@/types/team'
import type { GameEvent, GameEventPayload, GameEventPlayer, SummaryTeam } from '@/types/gameEvent'
import ActionCard from '@/components/common/ActionCard.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import RemovedBadge from '@/components/common/RemovedBadge.vue'
import GameEventFormDialog from './GameEventFormDialog.vue'

const props = defineProps<{ game: Game }>()

const emit = defineEmits<{ changed: [] }>()

const authStore = useAuthStore()
const snackbar = useSnackbar()
const eventTypes = useEventTypesStore()
const { errorMessage, destroy } = useCrud<GameEvent, GameEventPayload>(gameEventsService)

const can = {
  create: authStore.hasPermission('game_event:create'),
  update: authStore.hasPermission('game_event:update'),
  delete: authStore.hasPermission('game_event:delete'),
}

function byMinuteDesc(a: GameEvent, b: GameEvent): number {
  const minuteA = a.minute ?? null
  const minuteB = b.minute ?? null
  if (minuteA === minuteB) return b.id - a.id
  if (minuteA === null) return 1
  if (minuteB === null) return -1
  return minuteB - minuteA
}

const locked = computed(() => props.game.results_locked === true)
const canDelete = computed(() => can.delete && !locked.value)

const events = computed(() => [...(props.game.events ?? [])].sort(byMinuteDesc))
const formDialog = ref(false)
const formType = ref('')
const eventToEdit = ref<GameEvent | null>(null)
const { open: confirmOpen, target: eventToDelete, ask: askDelete } = useConfirmDialog<GameEvent>()

const typesPending = computed(() => !eventTypes.loaded && !eventTypes.errorMessage)

const teams = computed<SummaryTeam[]>(() =>
  [props.game.homeTeam, props.game.awayTeam]
    .filter((team): team is Team => !!team)
    .map((team) => ({
      id: team.id,
      name: team.nickname || team.name,
      players: [...(team.players ?? [])].sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
    })),
)

const goalsByTeam = computed(() => {
  const { home_team_id: home, away_team_id: away } = props.game
  const goals = { home: 0, away: 0 }
  for (const event of events.value) {
    const countsFor = eventTypes.bySlug(event.type).counts_for
    if (!countsFor || (event.team_id !== home && event.team_id !== away)) continue
    const isHome = event.team_id === home
    if (countsFor === 'team' ? isHome : !isHome) goals.home++
    else goals.away++
  }
  return goals
})

const scoreMismatch = computed(
  () =>
    eventTypes.loaded &&
    props.game.status === 'finished' &&
    props.game.home_score !== null &&
    props.game.away_score !== null &&
    (goalsByTeam.value.home !== props.game.home_score || goalsByTeam.value.away !== props.game.away_score),
)

function teamName(teamId: number): string {
  const team = [props.game.homeTeam, props.game.awayTeam].find((t) => t?.id === teamId)
  return team ? team.nickname || team.name : '—'
}

function eventPlayer(
  player: GameEventPlayer | null | undefined,
  playerId: number | null,
): Pick<GameEventPlayer, 'name' | 'removed'> | null {
  if (!playerId) return null
  if (player) return player
  for (const team of teams.value) {
    const found = team.players.find((p) => p.id === playerId)
    if (found) return { name: found.name, removed: false }
  }
  return { name: 'Jogador fora do elenco', removed: false }
}

function mainPlayer(event: GameEvent) {
  return eventPlayer(event.player, event.player_id)
}

function assistPlayer(event: GameEvent) {
  return eventPlayer(event.related_player, event.related_player_id)
}

function eventSubtitle(event: GameEvent): string {
  return `${eventTypes.bySlug(event.type).name} · ${teamName(event.team_id)}`
}

function loadTypes() {
  eventTypes.load().catch(() => undefined)
}

function openCreate(type: string) {
  eventToEdit.value = null
  formType.value = type
  formDialog.value = true
}

function openEdit(event: GameEvent) {
  eventToEdit.value = event
  formType.value = event.type
  formDialog.value = true
}

async function handleDelete() {
  if (!eventToDelete.value) return
  if (await destroy(eventToDelete.value.id)) {
    snackbar.success('Evento excluído com sucesso.')
    emit('changed')
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir o evento.')
    errorMessage.value = null
  }
  eventToDelete.value = null
}

onMounted(loadTypes)
</script>

<template>
  <v-card>
    <v-card-title class="text-subtitle-1 font-weight-bold">Súmula</v-card-title>

    <v-card-text>
      <v-alert
        v-if="eventTypes.errorMessage"
        type="warning"
        variant="tonal"
        class="mb-4"
        data-test="event-types-error"
      >
        Não foi possível carregar os tipos de evento: {{ eventTypes.errorMessage }}
        <template #append>
          <v-btn
            variant="text"
            size="small"
            :loading="eventTypes.loading"
            data-test="event-types-retry"
            @click="loadTypes"
          >
            Tentar de novo
          </v-btn>
        </template>
      </v-alert>

      <v-alert
        v-if="locked"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4"
        data-test="events-locked"
      >
        Os resultados da fase de grupos estão travados porque o mata-mata já foi gerado. Para
        corrigir, desfaça o mata-mata. Ainda dá para corrigir o jogador e o minuto dos eventos
        lançados.
      </v-alert>

      <template v-if="can.create && !locked">
        <v-row v-if="typesPending" dense class="mb-2" data-test="event-actions-loading">
          <v-col v-for="n in 4" :key="n" cols="6" sm="3">
            <v-skeleton-loader type="list-item-avatar" class="rounded-lg" />
          </v-col>
        </v-row>
        <v-row
          v-else-if="eventTypes.active.length > 0"
          dense
          class="mb-2"
          data-test="event-actions"
        >
          <v-col v-for="type in eventTypes.active" :key="type.slug" cols="6" sm="3">
            <ActionCard
              :icon="type.icon"
              :label="type.name"
              :color="type.color"
              data-test="event-action"
              @click="openCreate(type.slug)"
            />
          </v-col>
        </v-row>
        <div
          v-else-if="eventTypes.loaded"
          class="text-medium-emphasis text-body-2 mb-4"
          data-test="event-actions-empty"
        >
          Nenhum tipo de evento ativo para registrar.
        </div>
      </template>

      <v-alert v-if="scoreMismatch" type="info" variant="tonal" density="compact" class="mb-4" data-test="score-mismatch">
        Gols na súmula ({{ goalsByTeam.home }} × {{ goalsByTeam.away }}) diferem do placar da partida
        ({{ game.home_score }} × {{ game.away_score }}).
      </v-alert>

      <div v-if="events.length === 0" class="text-medium-emphasis text-center py-6" data-test="events-empty">
        Nenhum evento registrado nesta partida.
      </div>
      <v-list v-else lines="two" class="pa-0" data-test="events-list">
        <v-list-item
          v-for="event in events"
          :key="event.id"
          prepend-gap="12"
          class="px-0"
          data-test="event-row"
        >
          <template #prepend>
            <div class="minute text-medium-emphasis tabular">{{ event.minute != null ? `${event.minute}'` : '—' }}</div>
            <v-icon
              :icon="eventTypes.bySlug(event.type).icon"
              :color="eventTypes.bySlug(event.type).color"
              :aria-label="eventTypes.bySlug(event.type).name"
            />
          </template>
          <v-list-item-title class="d-flex align-center ga-1" data-test="event-player">
            <span class="text-truncate">{{ mainPlayer(event)?.name ?? '—' }}</span>
            <RemovedBadge v-if="mainPlayer(event)?.removed" />
          </v-list-item-title>
          <v-list-item-subtitle data-test="event-subtitle">
            {{ eventSubtitle(event) }}
          </v-list-item-subtitle>
          <v-list-item-subtitle
            v-if="assistPlayer(event)"
            class="d-block mt-1"
            data-test="event-assist-line"
          >
            Assistência: {{ assistPlayer(event)?.name }}
            <RemovedBadge v-if="assistPlayer(event)?.removed" />
          </v-list-item-subtitle>
          <template v-if="can.update || canDelete" #append>
            <v-btn
              v-if="can.update"
              icon="mdi-pencil"
              variant="text"
              size="small"
              :disabled="!eventTypes.loaded"
              data-test="event-edit"
              @click="openEdit(event)"
            />
            <v-btn
              v-if="canDelete"
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
      :type="formType"
      :event="eventToEdit"
      :locked="locked"
      @saved="emit('changed')"
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
