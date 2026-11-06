<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import {
  GAME_LEG_OPTIONS,
  GAME_STATUS_OPTIONS,
  gameStageLabel,
  isGeneratedKnockout,
} from '@/types/game'
import type { Game, GamePayload } from '@/types/game'
import type { LeagueFormat } from '@/types/championship'
import type { FixtureMode } from '@/types/leagueRules'
import type { Stadium } from '@/types/stadium'
import type { Team } from '@/types/team'
import FormDialog from '@/components/common/FormDialog.vue'
import { groupName } from '@/components/leagues/leagueGroups'
import { isReturnLegGame } from '@/components/leagues/leagueDraw'

const props = defineProps<{
  modelValue: boolean
  leagueId: number
  format?: LeagueFormat | null
  teams: Team[]
  stadiums: Stadium[]
  game?: Game | null
  knownPhases?: { phase: string; phase_order: number | null }[]
  fixtureMode?: FixtureMode | null
  roundsPerTurn?: number | null
  groupsCount?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [game: Game]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<Game, GamePayload>(gamesService)
const snackbar = useSnackbar()

const DEFAULT_PHASES = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']

type Stage = 'round' | 'phase'
const stage = ref<Stage>('round')
const isEditing = computed(() => !!props.game)
const isDrawn = computed(() => props.game?.group_number != null)
const isKnockout = computed(() => isGeneratedKnockout(props.game))
const roundUnavailable = computed(
  () => props.fixtureMode === 'draw' && !(isEditing.value && props.game?.round != null),
)
const phaseUnavailable = computed(
  () => props.fixtureMode === 'draw' && !(isEditing.value && props.game?.phase != null),
)
const knockoutLabel = computed(() =>
  props.game ? `${gameStageLabel(props.game)} · ${props.game.tie_key}` : '',
)
const unavailableHint = computed(() => {
  if (isKnockout.value) return null
  const phase = phaseUnavailable.value && props.format === 'hybrid'
  if (roundUnavailable.value && phase) {
    return 'Em ligas com sorteio, as partidas de rodada são criadas na tela Sorteio e as de mata-mata são geradas pela classificação.'
  }
  if (roundUnavailable.value) {
    return 'Em ligas com sorteio, as partidas de rodada são criadas na tela Sorteio.'
  }
  if (phase) {
    return 'Em ligas com sorteio, as partidas de mata-mata são geradas pela classificação.'
  }
  return null
})
const isReturnLeg = computed(() => !!props.game && isReturnLegGame(props.game, props.roundsPerTurn))
const drawnLabel = computed(() => {
  const game = props.game
  if (!game || game.group_number == null) return ''
  const round = `${game.round}ª rodada`
  return (props.groupsCount ?? 1) > 1 ? `${groupName(game.group_number)} · ${round}` : round
})

const form = reactive({
  home_team_id: null as number | null,
  away_team_id: null as number | null,
  stadium_id: null as number | null,
  match_date: '',
  status: 'scheduled' as GamePayload['status'],
  round: null as number | string | null,
  phase: null as string | null,
  phase_order: null as number | string | null,
  tie_key: null as string | null,
  leg: null as GamePayload['leg'],
})

const phaseItems = computed(() => {
  const known = (props.knownPhases ?? []).map((item) => item.phase)
  return [...new Set([...known, ...DEFAULT_PHASES])]
})

const sameTeam = computed(() => form.home_team_id !== null && form.home_team_id === form.away_team_id)

function toDateTimeLocal(date: string | null): string {
  return date ? date.replace(' ', 'T').slice(0, 16) : ''
}

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function swapTeams() {
  const home = form.home_team_id
  form.home_team_id = form.away_team_id
  form.away_team_id = home
}

function onPhaseChange(phase: string | null) {
  if (!phase || form.phase_order) return
  const known = props.knownPhases?.find((item) => item.phase === phase)
  if (known?.phase_order) form.phase_order = known.phase_order
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const game = props.game
    errorMessage.value = null
    fieldErrors.value = {}
    form.home_team_id = game?.home_team_id ?? null
    form.away_team_id = game?.away_team_id ?? null
    form.stadium_id = game?.stadium_id ?? null
    form.match_date = toDateTimeLocal(game?.match_date ?? null)
    form.status = game?.status ?? 'scheduled'
    form.round = game?.round ?? null
    form.phase = game?.phase ?? null
    form.phase_order = game?.phase_order ?? null
    form.tie_key = game?.tie_key ?? null
    form.leg = game?.leg ?? null
    if (props.format === 'knockout') stage.value = 'phase'
    else if (props.format === 'hybrid' && roundUnavailable.value) stage.value = 'phase'
    else if (props.format === 'hybrid') stage.value = game?.phase ? 'phase' : 'round'
    else stage.value = 'round'
  },
  { immediate: true },
)

async function handleSubmit() {
  if (sameTeam.value) return
  if (roundUnavailable.value && stage.value === 'round') return
  if (phaseUnavailable.value && stage.value === 'phase') return
  const usesPhase = stage.value === 'phase'
  const payload: GamePayload = {
    league_id: props.leagueId,
    home_team_id: form.home_team_id as number,
    away_team_id: form.away_team_id as number,
    stadium_id: form.stadium_id,
    match_date: form.match_date || null,
    status: isEditing.value ? form.status : 'scheduled',
    round: usesPhase ? null : toNullableNumber(form.round),
    phase: usesPhase ? form.phase?.trim() || null : null,
    phase_order: usesPhase ? toNullableNumber(form.phase_order) : null,
    tie_key: usesPhase ? form.tie_key?.trim() || null : null,
    leg: usesPhase ? form.leg : null,
  }
  const result = await save(payload, props.game?.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Partida atualizada com sucesso.' : 'Partida criada com sucesso.')
    emit('saved', result)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar partida' : 'Nova partida'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-alert
      v-if="isDrawn"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      data-test="game-drawn-notice"
    >
      <strong>Partida sorteada ({{ drawnLabel }}).</strong>
      Dá para mudar data, estádio e status e inverter o mando. Para excluir, desfaça a rodada no
      Sorteio.
    </v-alert>
    <v-alert
      v-if="isKnockout && game"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      data-test="game-knockout-notice"
    >
      <strong>Partida gerada pelo mata-mata ({{ knockoutLabel }}).</strong>
      Dá para mudar data, estádio e status. Times, fase e confronto vêm da classificação; para
      excluir ou refazer, desfaça a fase no Mata-mata do Sorteio.
    </v-alert>

    <v-row dense>
      <v-col cols="12">
        <v-autocomplete
          v-model="form.home_team_id"
          :items="teams"
          item-title="name"
          item-value="id"
          label="Mandante"
          :disabled="isReturnLeg || isKnockout"
          :error-messages="fieldErrors.home_team_id"
          data-test="game-home-team"
        />
      </v-col>
      <v-col cols="12">
        <v-autocomplete
          v-model="form.away_team_id"
          :items="teams"
          item-title="name"
          item-value="id"
          label="Visitante"
          :disabled="isReturnLeg || isKnockout"
          :hint="
            isReturnLeg
              ? 'No returno os confrontos seguem o turno; só é possível inverter o mando.'
              : undefined
          "
          :persistent-hint="isReturnLeg"
          :error-messages="sameTeam ? ['O visitante deve ser diferente do mandante.'] : fieldErrors.away_team_id"
          data-test="game-away-team"
        />
      </v-col>
      <v-col v-if="isDrawn" cols="12" class="mb-2">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-swap-vertical"
          data-test="game-swap-teams"
          @click="swapTeams"
        >
          Inverter mando
        </v-btn>
      </v-col>
      <v-col v-if="isEditing" cols="12" sm="6">
        <v-select
          v-model="form.status"
          :items="GAME_STATUS_OPTIONS"
          item-title="title"
          item-value="value"
          label="Status"
          :error-messages="fieldErrors.status"
          data-test="game-status"
        />
      </v-col>
      <v-col cols="12" :sm="isEditing ? 6 : 12">
        <v-text-field
          v-model="form.match_date"
          label="Data e hora"
          type="datetime-local"
          :error-messages="fieldErrors.match_date"
          data-test="game-match-date"
        />
      </v-col>
    </v-row>

    <v-btn-toggle
      v-if="format === 'hybrid'"
      v-model="stage"
      mandatory
      color="primary"
      variant="outlined"
      density="comfortable"
      :disabled="isDrawn || isKnockout"
      :class="unavailableHint ? 'mb-1' : 'mb-4'"
      data-test="game-stage-toggle"
    >
      <v-btn value="round" :disabled="roundUnavailable">
        <span class="d-none d-sm-inline">Rodada (grupos)</span>
        <span class="d-sm-none">Rodada</span>
      </v-btn>
      <v-btn value="phase" :disabled="phaseUnavailable">
        <span class="d-none d-sm-inline">Fase (mata-mata)</span>
        <span class="d-sm-none">Fase</span>
      </v-btn>
    </v-btn-toggle>
    <p
      v-if="unavailableHint"
      class="text-caption text-medium-emphasis mb-4"
      data-test="game-stage-unavailable"
    >
      {{ unavailableHint }}
    </p>

    <v-row dense>
      <v-col cols="12" sm="6">
        <v-text-field
          v-if="stage === 'round'"
          v-model="form.round"
          label="Rodada"
          type="number"
          min="1"
          :disabled="isDrawn || roundUnavailable"
          :error-messages="fieldErrors.round"
          data-test="game-round"
        />
        <v-combobox
          v-else
          v-model="form.phase"
          :items="phaseItems"
          label="Fase"
          :disabled="isKnockout || phaseUnavailable"
          :error-messages="fieldErrors.phase"
          data-test="game-phase"
          @update:model-value="onPhaseChange"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-autocomplete
          v-model="form.stadium_id"
          :items="stadiums"
          item-title="name"
          item-value="id"
          label="Estádio"
          clearable
          :error-messages="fieldErrors.stadium_id"
          data-test="game-stadium"
        />
      </v-col>
      <template v-if="stage === 'phase'">
        <v-col cols="4" sm="3">
          <v-text-field
            v-model="form.phase_order"
            label="Ordem"
            type="number"
            min="1"
            hint="1 = primeira fase"
            :disabled="isKnockout || phaseUnavailable"
            :error-messages="fieldErrors.phase_order"
            data-test="game-phase-order"
          />
        </v-col>
        <v-col cols="8" sm="5">
          <v-text-field
            v-model="form.tie_key"
            label="Confronto"
            hint="Mesma chave na ida e na volta (ex.: QF1)"
            :disabled="isKnockout || phaseUnavailable"
            :error-messages="fieldErrors.tie_key"
            data-test="game-tie-key"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="form.leg"
            :items="GAME_LEG_OPTIONS"
            item-title="title"
            item-value="value"
            label="Perna"
            :disabled="isKnockout || phaseUnavailable"
            :error-messages="fieldErrors.leg"
            data-test="game-leg"
          />
        </v-col>
      </template>
    </v-row>
  </FormDialog>
</template>
