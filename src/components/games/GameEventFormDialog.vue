<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { GAME_EVENT_TYPE_OPTIONS } from '@/types/gameEvent'
import type { GameEvent, GameEventPayload, SummaryTeam } from '@/types/gameEvent'
import type { Player } from '@/types/player'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  gameId: number
  // Só os dois times da partida: o jogador sempre sai do elenco de um deles.
  teams: SummaryTeam[]
  event?: GameEvent | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [event: GameEvent]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<GameEvent, GameEventPayload>(gameEventsService)
const snackbar = useSnackbar()

const form = reactive({
  type: 'goal' as GameEventPayload['type'],
  team_id: null as number | null,
  player_id: null as number | null,
  related_player_id: null as number | null,
  minute: null as number | string | null,
})

const isEditing = computed(() => !!props.event)

const teamPlayers = computed(
  () => props.teams.find((team) => team.id === form.team_id)?.players ?? [],
)
const assistPlayers = computed(() => teamPlayers.value.filter((player) => player.id !== form.player_id))

function playerTitle(player: Player): string {
  return player.number != null ? `${player.number} · ${player.name}` : player.name
}

// Trocar o time invalida jogador/assistência; trocar o autor limpa a assistência repetida.
function onTeamChange() {
  form.player_id = null
  form.related_player_id = null
}

watch(
  () => form.player_id,
  (playerId) => {
    if (form.related_player_id === playerId) form.related_player_id = null
  },
)

watch(
  () => form.type,
  (type) => {
    if (type !== 'goal') form.related_player_id = null
  },
)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    form.type = props.event?.type ?? 'goal'
    form.team_id = props.event?.team_id ?? null
    form.player_id = props.event?.player_id ?? null
    form.related_player_id = props.event?.related_player_id ?? null
    form.minute = props.event?.minute ?? null
  },
  { immediate: true },
)

async function handleSubmit() {
  if (!form.team_id || !form.player_id) {
    fieldErrors.value = {
      ...(form.team_id ? {} : { team_id: ['Selecione o time.'] }),
      ...(form.player_id ? {} : { player_id: ['Selecione o jogador.'] }),
    }
    return
  }
  const minute = form.minute === '' || form.minute === null ? null : Number(form.minute)
  const payload: GameEventPayload = {
    game_id: props.gameId,
    team_id: form.team_id,
    player_id: form.player_id,
    related_player_id: form.type === 'goal' ? form.related_player_id : null,
    type: form.type,
    minute,
  }
  const result = await save(payload, props.event?.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Evento atualizado com sucesso.' : 'Evento registrado com sucesso.')
    emit('saved', result)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar evento' : 'Registrar evento'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-btn-toggle
      v-model="form.type"
      mandatory
      color="primary"
      variant="outlined"
      density="comfortable"
      divided
      class="mb-4 type-toggle"
      data-test="event-type"
    >
      <v-btn v-for="option in GAME_EVENT_TYPE_OPTIONS" :key="option.value" :value="option.value" class="flex-grow-1">
        {{ option.title }}
      </v-btn>
    </v-btn-toggle>

    <v-select
      v-model="form.team_id"
      :items="teams"
      item-title="name"
      item-value="id"
      label="Time"
      :error-messages="fieldErrors.team_id"
      data-test="event-team"
      @update:model-value="onTeamChange"
    />
    <v-autocomplete
      v-model="form.player_id"
      :items="teamPlayers"
      :item-title="playerTitle"
      item-value="id"
      label="Jogador"
      :disabled="!form.team_id"
      no-data-text="Nenhum jogador no elenco deste time."
      :error-messages="fieldErrors.player_id"
      data-test="event-player"
    />
    <v-autocomplete
      v-if="form.type === 'goal'"
      v-model="form.related_player_id"
      :items="assistPlayers"
      :item-title="playerTitle"
      item-value="id"
      label="Assistência (opcional)"
      clearable
      :disabled="!form.player_id"
      :error-messages="fieldErrors.related_player_id"
      data-test="event-assist"
    />
    <v-text-field
      v-model="form.minute"
      label="Minuto"
      type="number"
      min="0"
      :error-messages="fieldErrors.minute"
      data-test="event-minute"
    />
  </FormDialog>
</template>

<style scoped>
.type-toggle {
  width: 100%;
}
</style>
