<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AxiosError } from 'axios'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import type { ApiErrorResponse } from '@/types/api'
import { hasPenalties } from '@/types/game'
import type { Game, PenaltyKickPayload } from '@/types/game'
import type { TeamSide } from '@/types/gameEvent'
import RemovedBadge from '@/components/common/RemovedBadge.vue'
import PenaltyShootoutGrid from './PenaltyShootoutGrid.vue'
import { filterPlayer, playerTitle, type PlayerOption } from './playerSearch'
import {
  canAddKick,
  draftResult,
  kickTeamId,
  repeatedKickers,
  savedKicks,
  shootoutDraftIssue,
  shootoutTeams,
  type ShootoutDraftKick,
} from './shootout'

const props = defineProps<{ game: Game }>()

const emit = defineEmits<{ saved: [game: Game] }>()

interface KickRow {
  key: number
  player_id: number | null
  scored: boolean | null
}

const snackbar = useSnackbar()

const root = ref<HTMLElement | null>(null)
const firstSide = ref<TeamSide | null>(null)
const rows = ref<KickRow[]>([])
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const busy = ref<'save' | 'clear' | null>(null)
const confirmingClear = ref(false)
let nextKey = 0

const teams = computed(() => shootoutTeams(props.game))
const homeId = computed(() => props.game.home_team_id)
const awayId = computed(() => props.game.away_team_id)
const locked = computed(() => props.game.results_locked === true)
const editable = computed(() => !!props.game.penalties_allowed && !locked.value)
const intro = computed(() => {
  if (locked.value) {
    return 'Disputa travada: a fase seguinte do mata-mata já foi gerada. Para corrigir, desfaça a fase seguinte.'
  }
  return editable.value
    ? 'O confronto terminou empatado depois dos critérios de desempate. Registre as cobranças na ordem da súmula. Pênaltis não contam nos gols da partida nem na artilharia.'
    : 'O confronto não está mais empatado ou ainda não foi encerrado. Limpe as cobranças registradas.'
})
const saved = computed(() => savedKicks(props.game))
const legacy = computed(() => saved.value.length === 0 && hasPenalties(props.game))
const hasSaved = computed(() => saved.value.length > 0 || legacy.value)

const firstTeamId = computed(() => {
  if (firstSide.value === 'home') return homeId.value
  if (firstSide.value === 'away') return awayId.value
  return null
})

const draft = computed<ShootoutDraftKick[]>(() => {
  const first = firstTeamId.value
  if (first === null) return []
  return rows.value.map((row, index) => ({
    team_id: kickTeamId(index, first, homeId.value, awayId.value),
    player_id: row.player_id,
    scored: row.scored,
  }))
})

const savedDraft = computed(() =>
  saved.value.map((kick) => ({
    team_id: kick.team_id,
    player_id: kick.player_id,
    scored: kick.scored,
  })),
)

function teamOptions(teamId: number): PlayerOption[] {
  const team = teamId === homeId.value ? props.game.homeTeam : props.game.awayTeam
  const options: PlayerOption[] = [...(team?.players ?? [])]
  for (const kick of saved.value) {
    const player = kick.player
    if (kick.team_id !== teamId || !player?.removed) continue
    if (options.some((option) => option.id === player.id)) continue
    options.push({ id: player.id, name: player.name, number: player.number, removed: true })
  }
  return options
}

const options = computed<Record<number, PlayerOption[]>>(() => ({
  [homeId.value]: teamOptions(homeId.value),
  [awayId.value]: teamOptions(awayId.value),
}))

function optionOf(teamId: number, playerId: number | null): PlayerOption | undefined {
  return options.value[teamId]?.find((option) => option.id === playerId)
}

function rosterSize(teamId: number): number {
  return options.value[teamId]?.filter((option) => !option.removed).length ?? 0
}

const result = computed(() => draftResult(draft.value, homeId.value, awayId.value))
const issue = computed(() => shootoutDraftIssue(draft.value, homeId.value, awayId.value))
const canAdd = computed(
  () => firstTeamId.value !== null && canAddKick(draft.value, homeId.value, awayId.value),
)
const repeated = computed(() => repeatedKickers(draft.value, rosterSize))
const afterDecision = computed(
  () => result.value.decided_at !== null && result.value.decided_at < rows.value.length,
)
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(savedDraft.value))

const gridKicks = computed(() =>
  draft.value.map((kick) => {
    const option = optionOf(kick.team_id, kick.player_id)
    return {
      team_id: kick.team_id,
      number: option?.number ?? null,
      name: option?.name ?? null,
      scored: kick.scored,
    }
  }),
)

function teamLabel(teamId: number): string {
  return teamId === homeId.value ? `M · ${teams.value.home.name}` : `V · ${teams.value.away.name}`
}

function rowErrors(index: number, field: 'team_id' | 'player_id' | 'scored'): string[] {
  return fieldErrors.value[`kicks.${index}.${field}`] ?? []
}

function clearErrors() {
  errorMessage.value = null
  fieldErrors.value = {}
}

function reset() {
  const first = saved.value[0]
  firstSide.value = first ? (first.team_id === homeId.value ? 'home' : 'away') : null
  rows.value = saved.value.map((kick) => ({
    key: nextKey++,
    player_id: kick.player_id,
    scored: kick.scored,
  }))
  confirmingClear.value = false
  clearErrors()
}

watch(() => `${props.game.id}:${JSON.stringify(savedDraft.value)}`, reset, { immediate: true })

function focusPlayer(index: number) {
  nextTick(() =>
    root.value
      ?.querySelector<HTMLInputElement>(`[data-test="kick-player-${index}"] input`)
      ?.focus(),
  )
}

function addRow() {
  if (!canAdd.value) return
  rows.value.push({ key: nextKey++, player_id: null, scored: null })
  focusPlayer(rows.value.length - 1)
}

function chooseFirst(side: TeamSide | null) {
  if (!side || side === firstSide.value) return
  const switched = firstSide.value !== null
  firstSide.value = side
  clearErrors()
  if (switched) rows.value.forEach((row) => (row.player_id = null))
  if (rows.value.length === 0) addRow()
}

function appendAfter(index: number) {
  if (index === rows.value.length - 1) addRow()
}

function setPlayer(index: number, playerId: number | null) {
  rows.value[index].player_id = playerId
  clearErrors()
  if (playerId !== null && rows.value[index].scored !== null) appendAfter(index)
}

function setResult(index: number, scored: boolean) {
  rows.value[index].scored = scored
  clearErrors()
  if (rows.value[index].player_id !== null) appendAfter(index)
}

function removeLast() {
  rows.value.pop()
  clearErrors()
}

function removeAfterDecision() {
  if (result.value.decided_at === null) return
  rows.value = rows.value.slice(0, result.value.decided_at)
  clearErrors()
}

function handleError(err: unknown) {
  const axiosErr = err as AxiosError<ApiErrorResponse>
  const errors = axiosErr.response?.status === 422 ? (axiosErr.response.data?.errors ?? {}) : {}
  fieldErrors.value = errors
  const general = errors.kicks?.[0] ?? errors.message?.[0]
  if (general) errorMessage.value = general
  else if (Object.keys(errors).length) errorMessage.value = 'Corrija as cobranças destacadas.'
  else errorMessage.value = extractErrorMessage(err)
}

async function send(action: 'save' | 'clear', kicks: PenaltyKickPayload[], success: string) {
  if (busy.value) return
  busy.value = action
  clearErrors()
  try {
    const game = await gamesService.updatePenaltyKicks(props.game.id, kicks)
    snackbar.success(success)
    emit('saved', game)
  } catch (err) {
    handleError(err)
  } finally {
    busy.value = null
  }
}

function save() {
  if (issue.value) return
  const kicks = draft.value.map((kick) => ({
    team_id: kick.team_id,
    player_id: kick.player_id as number,
    scored: kick.scored as boolean,
  }))
  send('save', kicks, 'Disputa de pênaltis salva.')
}

async function clear() {
  await send('clear', [], 'Disputa de pênaltis removida.')
  confirmingClear.value = false
}
</script>

<template>
  <v-card class="mb-4" data-test="game-penalties">
    <v-card-title class="text-subtitle-1 font-weight-bold">Disputa de pênaltis</v-card-title>
    <v-card-text>
      <div ref="root">
        <p class="text-body-2 text-medium-emphasis mb-3" data-test="game-penalties-intro">
          {{ intro }}
        </p>
        <v-alert
          v-if="legacy && editable && rows.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
          data-test="game-penalties-legacy"
        >
          Esta partida tem só o placar dos pênaltis ({{ game.home_penalties }} ×
          {{ game.away_penalties }}), sem as cobranças. Ao salvar as cobranças, o placar passa a vir
          delas.
        </v-alert>
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          data-test="game-penalties-error"
        >
          {{ errorMessage }}
        </v-alert>

        <PenaltyShootoutGrid
          :home="teams.home"
          :away="teams.away"
          :kicks="gridKicks"
          :first-team-id="firstTeamId"
          :home-penalties="rows.length ? null : game.home_penalties"
          :away-penalties="rows.length ? null : game.away_penalties"
          :live="editable"
        />
        <template v-if="editable">
          <v-divider class="my-4" />
          <v-radio-group
            :model-value="firstSide"
            label="Quem bateu primeiro?"
            inline
            hide-details
            class="mb-2"
            data-test="kick-first"
            @update:model-value="chooseFirst($event as TeamSide | null)"
          >
            <v-radio
              :label="`${teams.home.name} (mandante)`"
              value="home"
              data-test="kick-first-home"
            />
            <v-radio
              :label="`${teams.away.name} (visitante)`"
              value="away"
              data-test="kick-first-away"
            />
          </v-radio-group>

          <ol class="kick-list" aria-label="Cobranças">
            <li
              v-for="(kick, index) in draft"
              :key="rows[index].key"
              class="kick-row"
              data-test="kick-row"
            >
              <div class="d-flex align-center ga-2 mb-1">
                <span class="text-body-2 font-weight-bold">Cobrança {{ index + 1 }}</span>
                <v-chip size="small" variant="tonal" color="primary" data-test="kick-team">
                  {{ teamLabel(kick.team_id) }}
                </v-chip>
                <v-spacer />
                <v-btn
                  v-if="index === rows.length - 1"
                  icon="mdi-delete-outline"
                  variant="text"
                  size="small"
                  density="comfortable"
                  :aria-label="`Remover cobrança ${index + 1}`"
                  data-test="kick-remove"
                  @click="removeLast"
                />
              </div>
              <div class="d-flex flex-wrap align-start ga-2">
                <v-autocomplete
                  :model-value="kick.player_id"
                  :items="options[kick.team_id] ?? []"
                  :item-title="playerTitle"
                  item-value="id"
                  label="Cobrador"
                  density="compact"
                  class="kick-player"
                  :custom-filter="filterPlayer"
                  auto-select-first
                  no-data-text="Nenhum jogador com esse nº ou nome neste time."
                  :error-messages="rowErrors(index, 'player_id')"
                  :hide-details="rowErrors(index, 'player_id').length === 0"
                  :data-test="`kick-player-${index}`"
                  @update:model-value="setPlayer(index, ($event as number | null) ?? null)"
                >
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps" role="option">
                      <template v-if="item.raw.removed" #append><RemovedBadge /></template>
                    </v-list-item>
                  </template>
                  <template v-if="optionOf(kick.team_id, kick.player_id)?.removed" #append-inner>
                    <RemovedBadge />
                  </template>
                </v-autocomplete>
                <div
                  class="d-flex ga-2 kick-result"
                  role="group"
                  :aria-label="`Resultado da cobrança ${index + 1}`"
                >
                  <v-btn
                    color="success"
                    :variant="kick.scored === true ? 'flat' : 'outlined'"
                    prepend-icon="mdi-circle"
                    class="flex-grow-1"
                    height="40"
                    :aria-pressed="kick.scored === true"
                    data-test="kick-scored"
                    @click="setResult(index, true)"
                  >
                    Convertido
                  </v-btn>
                  <v-btn
                    color="error"
                    :variant="kick.scored === false ? 'flat' : 'outlined'"
                    prepend-icon="mdi-close"
                    class="flex-grow-1"
                    height="40"
                    :aria-pressed="kick.scored === false"
                    data-test="kick-missed"
                    @click="setResult(index, false)"
                  >
                    Perdido
                  </v-btn>
                </div>
              </div>
              <div
                v-if="repeated.has(index)"
                class="d-flex align-center ga-1 text-caption text-warning mt-1"
                data-test="kick-repeated"
              >
                <v-icon icon="mdi-alert-outline" size="small" />
                Este jogador já bateu na cobrança {{ repeated.get(index) }}, antes de todos do time.
                Confira a súmula.
              </div>
              <div
                v-for="message in [...rowErrors(index, 'team_id'), ...rowErrors(index, 'scored')]"
                :key="message"
                class="text-caption text-error mt-1"
                data-test="kick-error"
              >
                {{ message }}
              </div>
            </li>
          </ol>

          <v-btn
            v-if="canAdd && rows.length > 0"
            variant="tonal"
            prepend-icon="mdi-plus"
            data-test="kick-add"
            @click="addRow"
          >
            Adicionar cobrança
          </v-btn>
        </template>

        <v-alert
          v-if="editable && afterDecision"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-4"
          data-test="kick-after-decision"
        >
          {{ issue }}
          <template #append>
            <v-btn variant="text" size="small" data-test="kick-trim" @click="removeAfterDecision">
              Remover seguintes
            </v-btn>
          </template>
        </v-alert>
        <p
          v-else-if="editable && issue && rows.length > 0"
          class="text-body-2 text-medium-emphasis mt-4 mb-0"
          data-test="kick-issue"
        >
          {{ issue }}
        </p>

        <v-alert
          v-if="confirmingClear"
          type="warning"
          variant="tonal"
          class="mt-4"
          data-test="game-penalties-confirm-clear"
        >
          <div class="mb-2">Apagar todas as cobranças e o placar dos pênaltis desta partida?</div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              color="error"
              variant="flat"
              :loading="busy === 'clear'"
              :disabled="!!busy"
              data-test="game-penalties-clear-confirm"
              @click="clear"
            >
              Limpar disputa
            </v-btn>
            <v-btn
              variant="text"
              :disabled="!!busy"
              data-test="game-penalties-clear-cancel"
              @click="confirmingClear = false"
            >
              Cancelar
            </v-btn>
          </div>
        </v-alert>

        <div v-else class="d-flex flex-wrap ga-2 mt-4">
          <v-btn
            v-if="editable"
            color="primary"
            prepend-icon="mdi-content-save"
            :loading="busy === 'save'"
            :disabled="!!busy || !!issue || !dirty"
            data-test="game-penalties-save"
            @click="save"
          >
            Salvar disputa
          </v-btn>
          <v-btn
            v-if="editable && dirty"
            variant="text"
            :disabled="!!busy"
            data-test="game-penalties-discard"
            @click="reset"
          >
            Descartar alterações
          </v-btn>
          <v-btn
            v-if="hasSaved && !locked"
            variant="text"
            color="error"
            prepend-icon="mdi-close"
            :disabled="!!busy"
            data-test="game-penalties-clear"
            @click="confirmingClear = true"
          >
            Limpar disputa
          </v-btn>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.kick-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}
.kick-row {
  padding: 8px 0;
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.kick-player {
  flex: 1 1 200px;
  min-width: 0;
}
.kick-result {
  flex: 1 1 220px;
}
</style>
