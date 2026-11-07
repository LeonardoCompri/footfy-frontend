<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { useEventTypesStore } from '@/stores/eventTypes'
import type { GameResultsLock } from '@/types/game'
import type {
  EventTypeMeta,
  GameEvent,
  GameEventPayload,
  GameEventPlayer,
  SummaryTeam,
  TeamSide,
} from '@/types/gameEvent'
import FormDialog from '@/components/common/FormDialog.vue'
import RemovedBadge from '@/components/common/RemovedBadge.vue'
import { filterPlayer, playerTitle, type PlayerOption } from './playerSearch'

const props = defineProps<{
  modelValue: boolean
  gameId: number
  teams: SummaryTeam[]
  type: string
  event?: GameEvent | null
  lock?: GameResultsLock | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [event: GameEvent]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<GameEvent, GameEventPayload>(gameEventsService)
const snackbar = useSnackbar()
const eventTypes = useEventTypesStore()

const form = reactive({
  type: props.type,
  team_id: null as number | null,
  player_id: null as number | null,
  related_player_id: null as number | null,
  minute: null as number | string | null,
})

const isEditing = computed(() => !!props.event)
const scoreLocked = computed(() => props.lock === 'next_stage')
const lockedEdit = computed(() => {
  if (!isEditing.value || !props.lock) return false
  return props.lock === 'group_stage' || eventTypes.bySlug(props.event!.type).counts_for !== null
})
const currentType = computed(() => eventTypes.bySlug(form.type))
const title = computed(() =>
  isEditing.value ? 'Editar evento' : `Registrar ${currentType.value.name}`,
)

const typeOptions = computed(() => {
  const saved = props.event?.type
  const allowed = scoreLocked.value
    ? eventTypes.active.filter((type) => type.counts_for === null)
    : eventTypes.active
  if (!saved || allowed.some((type) => type.slug === saved)) return allowed
  return [...allowed, eventTypes.bySlug(saved)]
})

function typeTitle(type: EventTypeMeta): string {
  const name = type.abbreviation ? `${type.abbreviation} · ${type.name}` : type.name
  return type.active ? name : `${name} (inativo)`
}

const SIDE_LABELS: Record<TeamSide, string> = { home: 'Mandante', away: 'Visitante' }

function teamTitle(team: SummaryTeam): string {
  return `${SIDE_LABELS[team.side]} · ${team.name}`
}

const teamPlayers = computed(
  () => props.teams.find((team) => team.id === form.team_id)?.players ?? [],
)

function withSavedRemoved(saved: GameEventPlayer | null | undefined): PlayerOption[] {
  const players: PlayerOption[] = teamPlayers.value
  if (!saved?.removed || props.event?.team_id !== form.team_id) return players
  if (players.some((player) => player.id === saved.id)) return players
  return [...players, { id: saved.id, name: saved.name, number: null, removed: true }]
}

const playerOptions = computed(() => withSavedRemoved(props.event?.player))
const assistPlayers = computed(() =>
  withSavedRemoved(props.event?.related_player).filter((player) => player.id !== form.player_id),
)

function isRemoved(options: PlayerOption[], id: number | null): boolean {
  return options.some((player) => player.id === id && player.removed)
}

const noPlayerText = computed(() =>
  teamPlayers.value.length > 0
    ? 'Nenhum jogador com esse nº ou nome neste time.'
    : 'Nenhum jogador no elenco deste time.',
)

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

watch(currentType, (type) => {
  if (!type.allows_assist) form.related_player_id = null
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    form.type = props.event?.type ?? props.type
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
    related_player_id: currentType.value.allows_assist ? form.related_player_id : null,
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
    :title="title"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <template #title>
      <span class="d-flex align-center ga-2 min-w-0" data-test="event-form-title">
        <v-icon v-if="!isEditing" :icon="currentType.icon" :color="currentType.color" />
        <span class="text-wrap">{{ title }}</span>
      </span>
    </template>

    <v-text-field
      v-model="form.minute"
      label="Minuto"
      type="number"
      min="0"
      autofocus
      hint="Minuto corrido: o 2º tempo continua em 46, 47…"
      :error-messages="fieldErrors.minute"
      data-test="event-minute"
    />
    <v-select
      v-model="form.type"
      :items="typeOptions"
      :item-title="typeTitle"
      item-value="slug"
      label="Tipo"
      :disabled="lockedEdit"
      :error-messages="fieldErrors.type"
      data-test="event-type"
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps">
          <template #prepend>
            <v-icon :icon="item.raw.icon" :color="item.raw.color" />
          </template>
        </v-list-item>
      </template>
    </v-select>
    <v-select
      v-model="form.team_id"
      :items="teams"
      :item-title="teamTitle"
      item-value="id"
      label="Time"
      :disabled="lockedEdit"
      :hint="
        currentType.counts_for === 'opponent'
          ? 'Time do jogador que fez o lance; o evento conta para o adversário.'
          : undefined
      "
      :persistent-hint="currentType.counts_for === 'opponent'"
      :error-messages="fieldErrors.team_id"
      data-test="event-team"
      @update:model-value="onTeamChange"
    />
    <v-autocomplete
      v-model="form.player_id"
      :items="playerOptions"
      :item-title="playerTitle"
      item-value="id"
      label="Jogador"
      hint="Digite o nº da camisa ou o nome."
      :custom-filter="filterPlayer"
      auto-select-first
      :disabled="!form.team_id"
      :no-data-text="noPlayerText"
      :error-messages="fieldErrors.player_id"
      data-test="event-player"
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option">
          <template v-if="item.raw.removed" #append><RemovedBadge /></template>
        </v-list-item>
      </template>
      <template v-if="isRemoved(playerOptions, form.player_id)" #append-inner>
        <RemovedBadge />
      </template>
    </v-autocomplete>
    <v-autocomplete
      v-if="currentType.allows_assist"
      v-model="form.related_player_id"
      :items="assistPlayers"
      :item-title="playerTitle"
      item-value="id"
      label="Assistência (opcional)"
      hint="Digite o nº da camisa ou o nome."
      :custom-filter="filterPlayer"
      auto-select-first
      clearable
      :disabled="!form.player_id"
      :no-data-text="noPlayerText"
      :error-messages="fieldErrors.related_player_id"
      data-test="event-assist"
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option">
          <template v-if="item.raw.removed" #append><RemovedBadge /></template>
        </v-list-item>
      </template>
      <template v-if="isRemoved(assistPlayers, form.related_player_id)" #append-inner>
        <RemovedBadge />
      </template>
    </v-autocomplete>
  </FormDialog>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
