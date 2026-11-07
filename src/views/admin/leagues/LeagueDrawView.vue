<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { useQueryTab } from '@/composables/useQueryTab'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import { leaguesService } from '@/services/api/leagues.service'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import type { Game } from '@/types/game'
import type { LeagueDrawState } from '@/types/leagueDraw'
import { GROUP_LEGS_LABELS } from '@/types/leagueRules'
import {
  canDrawRound,
  drawConfirmation,
  drawPayload,
  drawRounds,
  progressTitle,
  TURN_LABELS,
  turnOf,
  type DrawConfirmation,
} from '@/components/leagues/leagueDraw'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import DrawResetDialog from '@/components/leagues/DrawResetDialog.vue'
import DrawRoundCard from '@/components/leagues/DrawRoundCard.vue'
import DrawRoundDialog from '@/components/leagues/DrawRoundDialog.vue'
import KnockoutPanel from '@/components/leagues/KnockoutPanel.vue'

type Action = 'draw' | 'undo' | 'reset'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const leagueId = leagueContext.activeLeagueId as number
const league = leagueContext.activeLeague
const canManage = authStore.hasPermission('tournament:update')

const initializing = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const state = ref<LeagueDrawState | null>(null)
const games = ref<Game[]>([])
const busy = ref<Action | null>(null)
const pendingConfirmation = ref<DrawConfirmation | null>(null)
const drawDialog = ref(false)
const undoDialog = ref(false)
const resetDialog = ref(false)
const { tab } = useQueryTab('grupos')

const rulesRoute = { name: 'admin-league-rules', params: { leagueId } }

const subtitle = computed(() =>
  [league?.name, league?.format ? LEAGUE_FORMAT_LABELS[league.format] : null]
    .filter(Boolean)
    .join(' · '),
)
const isDrawLeague = computed(() => state.value?.fixture_mode === 'draw')
const hasKnockout = computed(() => isDrawLeague.value && state.value?.format === 'hybrid')
const showGroupStage = computed(() => !hasKnockout.value || tab.value !== 'mata-mata')
const canDraw = computed(() => !!state.value && canDrawRound(state.value))
const totalRounds = computed(() => state.value?.total_rounds ?? null)
const rounds = computed(() => (state.value ? drawRounds(state.value, games.value) : []))
const showGroupNames = computed(() => (state.value?.groups_count ?? 1) > 1)
const progress = computed(() => {
  const drawn = state.value?.drawn_rounds ?? 0
  return totalRounds.value ? Math.round((drawn / totalRounds.value) * 100) : 0
})
const nextRoundLabel = computed(() => {
  const s = state.value
  if (!s || s.next_round === null) return null
  const turn = turnOf(s.next_round, s)
  return turn === 'single'
    ? `Próxima: rodada ${s.next_round}`
    : `Próxima: rodada ${s.next_round} · ${TURN_LABELS[turn]}`
})
const structureLabel = computed(() => {
  const s = state.value
  if (!s) return null
  const parts: string[] = []
  const groupsCount = s.groups_count ?? 1
  if (s.group_size) {
    parts.push(
      groupsCount > 1 ? `${groupsCount} grupos de ${s.group_size} times` : `${s.group_size} times`,
    )
  }
  if (s.group_legs) parts.push(GROUP_LEGS_LABELS[s.group_legs])
  return parts.join(' · ')
})
const needsGroups = computed(
  () => !!state.value && state.value.drawn_rounds === 0 && state.value.group_size === null,
)
const drawBlockedReason = computed(() =>
  canDraw.value ? null : (state.value?.draw_blocked_reason ?? null),
)

async function loadGames() {
  const all = await gamesService.listAll({ league_id: leagueId })
  games.value = all.filter((game) => game.group_number != null && game.round != null)
}

async function applyState(next: LeagueDrawState) {
  state.value = next
  if (next.drawn_rounds > 0) await loadGames()
  else games.value = []
}

async function refresh() {
  loadError.value = null
  try {
    await applyState(await leaguesService.draw(leagueId))
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

async function run(action: Action, request: () => Promise<LeagueDrawState>, success: string) {
  if (busy.value) return
  busy.value = action
  actionError.value = null
  try {
    const next = await request()
    snackbar.success(success)
    await applyState(next).catch((err) => (actionError.value = extractErrorMessage(err)))
  } catch (err) {
    actionError.value = extractErrorMessage(err)
    await refresh()
  } finally {
    busy.value = null
  }
}

function requestDraw() {
  if (!state.value || !canDraw.value || busy.value) return
  const confirmation = drawConfirmation(state.value)
  if (confirmation) {
    pendingConfirmation.value = confirmation
    drawDialog.value = true
    return
  }
  drawNextRound(null)
}

function drawNextRound(confirmation: DrawConfirmation | null) {
  const round = state.value?.next_round
  if (!round) return
  run(
    'draw',
    () => leaguesService.drawNextRound(leagueId, drawPayload(round, confirmation)),
    `Rodada ${round} sorteada.`,
  )
}

function undoRound() {
  const round = state.value?.drawn_rounds
  if (!round) return
  run('undo', () => leaguesService.undoLastRound(leagueId, round), `Rodada ${round} desfeita.`)
}

function resetDraw() {
  run('reset', () => leaguesService.resetDraw(leagueId), 'Sorteio reiniciado.')
}
</script>

<template>
  <div>
    <PageHeader title="Sorteio" :subtitle="subtitle">
      <template v-if="canManage" #action>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-file-document-edit-outline"
          :to="rulesRoute"
          data-test="draw-rules-link"
        >
          Regulamento
        </v-btn>
      </template>
    </PageHeader>

    <v-card v-if="initializing">
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
    </v-card>

    <v-alert v-else-if="loadError" type="error" variant="tonal" data-test="draw-load-error">
      {{ loadError }}
    </v-alert>

    <v-alert
      v-else-if="state && !isDrawLeague"
      type="info"
      variant="tonal"
      data-test="draw-not-enabled"
    >
      Esta liga não usa sorteio de rodadas: as partidas são cadastradas manualmente.
      <template v-if="canManage">Para mudar, altere a tabela de jogos no Regulamento.</template>
    </v-alert>

    <template v-else-if="state">
      <v-tabs
        v-if="hasKnockout"
        v-model="tab"
        color="primary"
        class="mb-4"
        show-arrows
        data-test="draw-tabs"
      >
        <v-tab value="grupos" data-test="tab-grupos">Fase de grupos</v-tab>
        <v-tab value="mata-mata" data-test="tab-mata-mata">Mata-mata</v-tab>
      </v-tabs>

      <KnockoutPanel
        v-if="hasKnockout && tab === 'mata-mata'"
        :league-id="leagueId"
        :can-manage="canManage"
        @changed="refresh"
      />

      <template v-if="showGroupStage">
        <v-alert
          v-if="actionError"
          type="error"
          variant="tonal"
          class="mb-4"
          closable
          data-test="draw-error"
          @click:close="actionError = null"
        >
          {{ actionError }}
        </v-alert>

        <v-card class="mb-4" data-test="draw-progress">
          <v-card-text>
            <div class="d-flex flex-wrap align-center ga-2 mb-2">
              <span class="text-h6 font-weight-bold" data-test="draw-progress-title">
                {{ progressTitle(state.drawn_rounds, totalRounds) }}
              </span>
              <v-chip
                v-if="state.next_round === null && state.drawn_rounds > 0"
                color="success"
                size="small"
                variant="tonal"
                prepend-icon="mdi-check"
                data-test="draw-complete"
              >
                Sorteio concluído
              </v-chip>
            </div>
            <v-progress-linear
              v-if="totalRounds"
              :model-value="progress"
              color="primary"
              rounded
              height="8"
              class="mb-2"
            />
            <div class="d-flex flex-wrap gc-4 text-body-2 text-medium-emphasis">
              <span v-if="nextRoundLabel" data-test="draw-next-round">{{ nextRoundLabel }}</span>
              <span v-if="structureLabel" data-test="draw-structure">{{ structureLabel }}</span>
            </div>

            <v-alert
              v-if="drawBlockedReason"
              :type="state.next_round === null ? 'success' : 'warning'"
              variant="tonal"
              density="compact"
              class="mt-4"
              data-test="draw-blocked"
            >
              {{ drawBlockedReason }}
              <div v-if="needsGroups && canManage" class="mt-2">
                <v-btn
                  size="small"
                  variant="flat"
                  color="warning"
                  prepend-icon="mdi-account-group"
                  :to="rulesRoute"
                  data-test="draw-groups-link"
                >
                  Montar grupos no Regulamento
                </v-btn>
              </div>
            </v-alert>

            <v-row v-if="canManage" dense class="mt-4" data-test="draw-actions">
              <v-col cols="12" sm="auto">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-dice-multiple-outline"
                  block
                  :loading="busy === 'draw'"
                  :disabled="!canDraw || !!busy"
                  data-test="draw-next"
                  @click="requestDraw"
                >
                  {{ state.next_round ? `Sortear rodada ${state.next_round}` : 'Sortear rodada' }}
                </v-btn>
              </v-col>
              <template v-if="state.drawn_rounds > 0">
                <v-col cols="12" sm="auto">
                  <v-btn
                    variant="tonal"
                    prepend-icon="mdi-undo"
                    block
                    :loading="busy === 'undo'"
                    :disabled="!state.can_undo || !!busy"
                    data-test="draw-undo"
                    @click="undoDialog = true"
                  >
                    Desfazer rodada {{ state.drawn_rounds }}
                  </v-btn>
                </v-col>
                <v-col cols="12" sm="auto">
                  <v-btn
                    variant="text"
                    color="error"
                    prepend-icon="mdi-restart"
                    block
                    :loading="busy === 'reset'"
                    :disabled="!state.can_reset || !!busy"
                    data-test="draw-reset"
                    @click="resetDialog = true"
                  >
                    Reiniciar sorteio
                  </v-btn>
                </v-col>
              </template>
            </v-row>
            <div
              v-if="canManage && state.drawn_rounds > 0"
              class="text-caption text-medium-emphasis mt-2"
            >
              <div v-if="state.undo_blocked_reason" data-test="draw-undo-blocked">
                {{ state.undo_blocked_reason }}
              </div>
              <div
                v-if="
                  state.reset_blocked_reason &&
                  state.reset_blocked_reason !== state.undo_blocked_reason
                "
                data-test="draw-reset-blocked"
              >
                {{ state.reset_blocked_reason }}
              </div>
            </div>
          </v-card-text>
        </v-card>

        <div v-if="rounds.length" class="d-flex flex-column ga-4" data-test="draw-rounds">
          <DrawRoundCard
            v-for="view in rounds"
            :key="view.round"
            :view="view"
            :league-id="leagueId"
            :show-group-names="showGroupNames"
          />
        </div>
        <v-card v-else data-test="draw-empty">
          <v-card-text class="text-center text-medium-emphasis py-8">
            Nenhuma rodada sorteada ainda.
          </v-card-text>
        </v-card>
      </template>
    </template>

    <DrawRoundDialog
      v-if="pendingConfirmation && state?.next_round"
      v-model="drawDialog"
      :round="state.next_round"
      :confirmation="pendingConfirmation"
      @confirm="drawNextRound(pendingConfirmation)"
    />
    <ConfirmDialog
      v-model="undoDialog"
      title="Desfazer rodada"
      :message="`As partidas da rodada ${state?.drawn_rounds} serão apagadas em todos os grupos. Deseja continuar?`"
      confirm-text="Desfazer"
      @confirm="undoRound"
    />
    <DrawResetDialog
      v-model="resetDialog"
      :drawn-rounds="state?.drawn_rounds ?? 0"
      @confirm="resetDraw"
    />
  </div>
</template>
