<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { leaguesService } from '@/services/api/leagues.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { KNOCKOUT_STAGES, type LeagueKnockoutState } from '@/types/leagueKnockout'
import type { KnockoutPhase } from '@/types/leagueStats'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import KnockoutPhases from './KnockoutPhases.vue'
import KnockoutStageDialog from './KnockoutStageDialog.vue'
import {
  bracketConfig,
  canGenerateStage,
  canUndoStage,
  generateLabel,
  knockoutConfirmation,
  nextStageLabel,
  nextStagePayload,
  undoLabel,
  undoMessage,
} from './leagueKnockout'

type Action = 'generate' | 'undo'

const props = defineProps<{
  leagueId: number
  canManage: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()

const initializing = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const state = ref<LeagueKnockoutState | null>(null)
const phases = ref<KnockoutPhase[]>([])
const busy = ref<Action | null>(null)
const generateDialog = ref(false)
const undoDialog = ref(false)

const canGenerate = computed(() => !!state.value && canGenerateStage(state.value))
const canUndo = computed(() => !!state.value && canUndoStage(state.value))
const confirmation = computed(() => (state.value ? knockoutConfirmation(state.value) : null))
const complete = computed(
  () => !!state.value && state.value.next_stage === null && state.value.last_stage !== null,
)
const generateBlockedReason = computed(() =>
  canGenerate.value || complete.value ? null : (state.value?.generate_blocked_reason ?? null),
)
const bracket = computed(() => {
  const league = leagueContext.activeLeague
  if (!league || !state.value) return null
  return bracketConfig({
    ...league,
    knockout_size: state.value.knockout_size,
    third_place: state.value.third_place,
  })
})

function gameRoute(gameId: number) {
  return { name: 'admin-games-detail', params: { leagueId: props.leagueId, id: gameId } }
}

function sumulaRoute(gameId: number) {
  return { ...gameRoute(gameId), query: { tab: 'sumula' } }
}

async function loadPhases() {
  const table = await leaguesService.table(props.leagueId)
  phases.value = table.phases ?? []
}

async function refresh() {
  loadError.value = null
  try {
    const [next] = await Promise.all([leaguesService.knockout(props.leagueId), loadPhases()])
    state.value = next
  } catch (err) {
    loadError.value = extractErrorMessage(err)
  }
}

onMounted(async () => {
  try {
    await refresh()
  } finally {
    initializing.value = false
  }
})

async function run(action: Action, request: () => Promise<LeagueKnockoutState>, success: string) {
  if (busy.value) return
  busy.value = action
  actionError.value = null
  try {
    state.value = await request()
    snackbar.success(success)
    await loadPhases().catch((err) => (actionError.value = extractErrorMessage(err)))
    emit('changed')
  } catch (err) {
    actionError.value = extractErrorMessage(err)
    await refresh()
  } finally {
    busy.value = null
  }
}

function openGenerate() {
  if (!canGenerate.value || busy.value) return
  generateDialog.value = true
}

function generate() {
  const next = state.value?.next_stage
  if (!next || !confirmation.value) return
  const payload = nextStagePayload(next.key, confirmation.value)
  const label = next.with_third_place ? 'Final e disputa de 3º lugar' : next.label
  run(
    'generate',
    () => leaguesService.knockoutNextStage(props.leagueId, payload),
    `${label}: confrontos gerados.`,
  )
}

function undo() {
  const last = state.value?.last_stage
  if (!last) return
  run(
    'undo',
    () => leaguesService.undoKnockoutStage(props.leagueId, last),
    `${KNOCKOUT_STAGES[last].label}: fase desfeita.`,
  )
}
</script>

<template>
  <div>
    <v-card v-if="initializing">
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
    </v-card>

    <v-alert v-else-if="loadError" type="error" variant="tonal" data-test="knockout-load-error">
      {{ loadError }}
    </v-alert>

    <v-alert
      v-else-if="state && !state.enabled"
      type="info"
      variant="tonal"
      data-test="knockout-not-enabled"
    >
      O mata-mata pela classificação só está disponível em ligas com fase de grupos e sorteio.
    </v-alert>

    <template v-else-if="state">
      <v-alert
        v-if="actionError"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
        data-test="knockout-error"
        @click:close="actionError = null"
      >
        {{ actionError }}
      </v-alert>

      <v-card class="mb-4" data-test="knockout-progress">
        <v-card-text>
          <div class="d-flex flex-wrap align-center ga-2 mb-3">
            <span class="text-h6 font-weight-bold">Mata-mata</span>
            <v-chip
              v-if="complete"
              color="success"
              size="small"
              variant="tonal"
              prepend-icon="mdi-check"
              data-test="knockout-complete"
            >
              Mata-mata gerado
            </v-chip>
          </div>

          <div v-if="state.stages.length" class="d-flex flex-wrap ga-2 mb-2">
            <v-chip
              v-for="stage in state.stages"
              :key="stage.key"
              size="small"
              :color="stage.generated ? 'success' : undefined"
              :variant="stage.generated ? 'tonal' : 'outlined'"
              :prepend-icon="stage.generated ? 'mdi-check' : 'mdi-clock-outline'"
              :data-generated="stage.generated"
              data-test="knockout-stage"
            >
              {{ stage.label }}
              <span class="d-sr-only">{{ stage.generated ? '(gerada)' : '(pendente)' }}</span>
            </v-chip>
          </div>

          <div
            v-if="nextStageLabel(state)"
            class="text-body-2 text-medium-emphasis"
            data-test="knockout-next"
          >
            {{ nextStageLabel(state) }}
          </div>

          <v-alert
            v-if="generateBlockedReason"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-4"
            data-test="knockout-blocked"
          >
            {{ generateBlockedReason }}
          </v-alert>

          <v-alert
            v-if="state.awaiting_penalties.length"
            type="warning"
            variant="tonal"
            density="compact"
            icon="mdi-timer-sand"
            class="mt-4"
            data-test="knockout-awaiting"
          >
            <div class="mb-1">
              {{
                state.awaiting_penalties.length === 1
                  ? 'Um confronto está empatado e aguarda os pênaltis:'
                  : 'Confrontos empatados aguardando os pênaltis:'
              }}
            </div>
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                v-for="item in state.awaiting_penalties"
                :key="item.tie_key"
                size="small"
                variant="flat"
                color="warning"
                append-icon="mdi-arrow-right"
                :to="sumulaRoute(item.game_id)"
                data-test="knockout-awaiting-link"
              >
                {{ item.tie_key }}: lançar pênaltis
              </v-btn>
            </div>
          </v-alert>

          <v-row v-if="canManage" dense class="mt-4" data-test="knockout-actions">
            <v-col v-if="state.next_stage" cols="12" sm="auto">
              <v-btn
                color="primary"
                prepend-icon="mdi-tournament"
                block
                :loading="busy === 'generate'"
                :disabled="!canGenerate || !!busy"
                data-test="knockout-generate"
                @click="openGenerate"
              >
                {{ generateLabel(state) }}
              </v-btn>
            </v-col>
            <v-col v-if="state.last_stage" cols="12" sm="auto">
              <v-btn
                variant="tonal"
                prepend-icon="mdi-undo"
                block
                :loading="busy === 'undo'"
                :disabled="!canUndo || !!busy"
                data-test="knockout-undo"
                @click="undoDialog = true"
              >
                {{ undoLabel(state) }}
              </v-btn>
            </v-col>
          </v-row>
          <div
            v-if="canManage && state.last_stage && state.undo_blocked_reason"
            class="text-caption text-medium-emphasis mt-2"
            data-test="knockout-undo-blocked"
          >
            {{ state.undo_blocked_reason }}
          </div>
        </v-card-text>
      </v-card>

      <v-card data-test="knockout-bracket">
        <v-card-title class="text-subtitle-1 font-weight-bold">Chaveamento</v-card-title>
        <v-card-text>
          <KnockoutPhases :phases="phases" :bracket="bracket" :leg-route="gameRoute" />
        </v-card-text>
      </v-card>
    </template>

    <KnockoutStageDialog
      v-if="state?.next_stage && confirmation"
      v-model="generateDialog"
      :league-id="leagueId"
      :title="generateLabel(state)"
      :confirmation="confirmation"
      @confirm="generate"
    />
    <ConfirmDialog
      v-model="undoDialog"
      :title="state ? undoLabel(state) : ''"
      :message="state ? undoMessage(state) : ''"
      confirm-text="Desfazer"
      @confirm="undo"
    />
  </div>
</template>
