<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { playersService } from '@/services/api/players.service'
import { GAME_EVENT_TYPE_OPTIONS } from '@/types/gameEvent'
import type { GameEvent, GameEventPayload } from '@/types/gameEvent'
import type { Player, PlayerPayload } from '@/types/player'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const props = defineProps<{
  gameId: string
  homeTeamId: number
  awayTeamId: number
  homeTeamName: string
  awayTeamName: string
}>()

const { items: events, loading, errorMessage, fieldErrors, fetchAll, save, destroy } = useCrud<
  GameEvent,
  GameEventPayload
>(gameEventsService)
const { items: allPlayers, fetchAll: fetchAllPlayers } = useCrud<Player, PlayerPayload>(
  playersService,
)
const authStore = useAuthStore()
const snackbar = useSnackbar()

const gameEvents = computed(() =>
  events.value.filter((event) => event.game_id === Number(props.gameId)),
)

const teamOptions = computed(() => [
  { id: props.homeTeamId, name: props.homeTeamName },
  { id: props.awayTeamId, name: props.awayTeamName },
])

const headers = [
  { title: 'Time', key: 'team_id' },
  { title: 'Jogador', key: 'player_id' },
  { title: 'Tipo', key: 'type' },
  { title: 'Minuto', key: 'minute' },
  { title: 'Assistência', key: 'related_player_id' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

const dialog = ref(false)
const editingId = ref<number | null>(null)
const confirmDialog = ref(false)
const eventToDelete = ref<GameEvent | null>(null)

const form = reactive<GameEventPayload>({
  game_id: Number(props.gameId),
  team_id: 0,
  player_id: 0,
  related_player_id: null,
  type: 'goal',
  minute: null,
})

const eligiblePlayers = computed(() =>
  allPlayers.value.filter((player) => player.team_id === form.team_id),
)

const eligibleAssistPlayers = computed(() =>
  eligiblePlayers.value.filter((player) => player.id !== form.player_id),
)

const eventFormInvalid = computed(() => !form.team_id || !form.player_id)

// Evita registrar o mesmo jogador como autor e como assistência: se um dos
// dois campos passar a repetir o valor do outro, o que ficou desatualizado é limpo.
watch(
  () => form.player_id,
  (playerId) => {
    if (form.related_player_id === playerId) {
      form.related_player_id = null
    }
  },
)

function teamName(teamId: number): string {
  return teamOptions.value.find((team) => team.id === teamId)?.name ?? '—'
}

function playerName(playerId: number | null): string {
  if (!playerId) return '—'
  return allPlayers.value.find((player) => player.id === playerId)?.name ?? '—'
}

function typeTitle(type: GameEvent['type']): string {
  return GAME_EVENT_TYPE_OPTIONS.find((option) => option.value === type)?.title ?? type
}

function resetForm() {
  form.game_id = Number(props.gameId)
  form.team_id = 0
  form.player_id = 0
  form.related_player_id = null
  form.type = 'goal'
  form.minute = null
}

function openCreateDialog() {
  editingId.value = null
  resetForm()
  dialog.value = true
}

function onTeamChange() {
  form.player_id = 0
  form.related_player_id = null
}

function openEditDialog(event: GameEvent) {
  editingId.value = event.id
  form.game_id = event.game_id
  form.team_id = event.team_id
  form.player_id = event.player_id
  form.related_player_id = event.related_player_id
  form.type = event.type
  form.minute = event.minute
  dialog.value = true
}

function askDelete(event: GameEvent) {
  eventToDelete.value = event
  confirmDialog.value = true
}

async function handleDelete() {
  if (!eventToDelete.value) return
  const ok = await destroy(eventToDelete.value.id)
  if (ok) {
    snackbar.success('Evento excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o evento.')
  }
  eventToDelete.value = null
}

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

async function handleSubmit() {
  form.minute = toNullableNumber(form.minute)
  const wasEditing = editingId.value
  const result = await save(form, wasEditing ?? undefined)
  if (result) {
    // Atualiza a lista local em vez de refazer fetchAll(): o endpoint não
    // filtra por game_id, então um refetch buscaria todos os eventos do sistema.
    if (wasEditing) {
      const index = events.value.findIndex((event) => event.id === result.id)
      if (index !== -1) events.value[index] = result
    } else {
      events.value.push(result)
    }
    snackbar.success(wasEditing ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso.')
    dialog.value = false
  }
}

onMounted(() => {
  fetchAll()
  fetchAllPlayers()
})
</script>

<template>
  <v-card class="mt-6">
    <v-card-item>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Eventos da Partida</span>
        <v-btn
          v-if="authStore.hasPermission('game_event:create')"
          color="primary"
          prepend-icon="mdi-plus"
          size="small"
          @click="openCreateDialog"
        >
          Adicionar evento
        </v-btn>
      </v-card-title>
    </v-card-item>

    <v-card-text>
      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

      <v-data-table :headers="headers" :items="gameEvents" :loading="loading" item-value="id">
        <template v-slot:[`item.team_id`]="{ item }">{{ teamName(item.team_id) }}</template>
        <template v-slot:[`item.player_id`]="{ item }">{{ playerName(item.player_id) }}</template>
        <template v-slot:[`item.type`]="{ item }">{{ typeTitle(item.type) }}</template>
        <template v-slot:[`item.minute`]="{ item }">{{ item.minute ?? '—' }}</template>
        <template v-slot:[`item.related_player_id`]="{ item }">
          {{ playerName(item.related_player_id) }}
        </template>
        <template v-slot:[`item.actions`]="{ item }">
          <v-btn
            v-if="authStore.hasPermission('game_event:update')"
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="openEditDialog(item)"
          />
          <v-btn
            v-if="authStore.hasPermission('game_event:delete')"
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="askDelete(item)"
          />
        </template>
      </v-data-table>
    </v-card-text>

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-title>{{ editingId ? 'Editar Evento' : 'Novo Evento' }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleSubmit">
            <v-select
              v-model="form.team_id"
              :items="teamOptions"
              item-title="name"
              item-value="id"
              label="Time"
              :error-messages="fieldErrors.team_id"
              class="mb-2"
              @update:model-value="onTeamChange"
            />
            <v-autocomplete
              v-model="form.player_id"
              :items="eligiblePlayers"
              item-title="name"
              item-value="id"
              label="Jogador"
              :disabled="!form.team_id"
              :error-messages="fieldErrors.player_id"
              class="mb-2"
            />
            <v-select
              v-model="form.type"
              :items="GAME_EVENT_TYPE_OPTIONS"
              item-title="title"
              item-value="value"
              label="Tipo"
              :error-messages="fieldErrors.type"
              class="mb-2"
            />
            <v-autocomplete
              v-model="form.related_player_id"
              :items="eligibleAssistPlayers"
              item-title="name"
              item-value="id"
              label="Assistência"
              clearable
              :disabled="!form.team_id"
              :error-messages="fieldErrors.related_player_id"
              class="mb-2"
            />
            <v-text-field
              v-model.number="form.minute"
              label="Minuto"
              type="number"
              min="0"
              :error-messages="fieldErrors.minute"
              class="mb-2"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            :loading="loading"
            :disabled="eventFormInvalid"
            @click="handleSubmit"
          >
            Salvar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir evento"
      message="Tem certeza que deseja excluir este evento?"
      @confirm="handleDelete"
    />
  </v-card>
</template>
