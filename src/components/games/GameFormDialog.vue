<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import { GAME_LEG_OPTIONS, GAME_STATUS_OPTIONS } from '@/types/game'
import type { Game, GamePayload } from '@/types/game'
import type { LeagueFormat } from '@/types/championship'
import type { Stadium } from '@/types/stadium'
import type { Team } from '@/types/team'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  leagueId: number
  format?: LeagueFormat | null
  teams: Team[]
  stadiums: Stadium[]
  game?: Game | null
  // Fases já usadas na liga, sugeridas no campo Fase (com a ordem de cada uma).
  knownPhases?: { phase: string; phase_order: number | null }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [game: Game]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<Game, GamePayload>(gamesService)
const snackbar = useSnackbar()

const DEFAULT_PHASES = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']

// Espelha GameStoreRequest: pontos corridos usa Rodada, mata-mata usa Fase e o híbrido
// aceita os dois (nunca ao mesmo tempo).
type Stage = 'round' | 'phase'
const stage = ref<Stage>('round')
const isEditing = computed(() => !!props.game)

const form = reactive({
  home_team_id: null as number | null,
  away_team_id: null as number | null,
  stadium_id: null as number | null,
  match_date: '',
  status: 'scheduled' as GamePayload['status'],
  home_score: null as number | string | null,
  away_score: null as number | string | null,
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

// Ao escolher uma fase já usada na liga, reaproveita a ordem dela (se ainda vazia).
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
    form.home_score = game?.home_score ?? null
    form.away_score = game?.away_score ?? null
    form.round = game?.round ?? null
    form.phase = game?.phase ?? null
    form.phase_order = game?.phase_order ?? null
    form.tie_key = game?.tie_key ?? null
    form.leg = game?.leg ?? null
    if (props.format === 'knockout') stage.value = 'phase'
    else if (props.format === 'hybrid') stage.value = game?.phase ? 'phase' : 'round'
    else stage.value = 'round'
  },
  { immediate: true },
)

async function handleSubmit() {
  if (sameTeam.value) return
  const usesPhase = stage.value === 'phase'
  const payload: GamePayload = {
    league_id: props.leagueId,
    home_team_id: form.home_team_id as number,
    away_team_id: form.away_team_id as number,
    stadium_id: form.stadium_id,
    match_date: form.match_date || null,
    status: form.status,
    home_score: toNullableNumber(form.home_score),
    away_score: toNullableNumber(form.away_score),
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
    <v-row dense>
      <v-col cols="12" sm="6">
        <v-autocomplete
          v-model="form.home_team_id"
          :items="teams"
          item-title="name"
          item-value="id"
          label="Mandante"
          :error-messages="fieldErrors.home_team_id"
          data-test="game-home-team"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-autocomplete
          v-model="form.away_team_id"
          :items="teams"
          item-title="name"
          item-value="id"
          label="Visitante"
          :error-messages="sameTeam ? ['O visitante deve ser diferente do mandante.'] : fieldErrors.away_team_id"
          data-test="game-away-team"
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
      class="mb-4"
      data-test="game-stage-toggle"
    >
      <v-btn value="round">Rodada (grupos)</v-btn>
      <v-btn value="phase">Fase (mata-mata)</v-btn>
    </v-btn-toggle>

    <v-text-field
      v-if="stage === 'round'"
      v-model="form.round"
      label="Rodada"
      type="number"
      min="1"
      :error-messages="fieldErrors.round"
      data-test="game-round"
    />
    <template v-else>
      <v-row dense>
        <v-col cols="8">
          <v-combobox
            v-model="form.phase"
            :items="phaseItems"
            label="Fase"
            :error-messages="fieldErrors.phase"
            data-test="game-phase"
            @update:model-value="onPhaseChange"
          />
        </v-col>
        <v-col cols="4">
          <v-text-field
            v-model="form.phase_order"
            label="Ordem"
            type="number"
            min="1"
            hint="1 = primeira fase"
            :error-messages="fieldErrors.phase_order"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.tie_key"
            label="Confronto"
            hint="Mesma chave na ida e na volta (ex.: QF1)"
            :error-messages="fieldErrors.tie_key"
            data-test="game-tie-key"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-select
            v-model="form.leg"
            :items="GAME_LEG_OPTIONS"
            item-title="title"
            item-value="value"
            label="Perna"
            :error-messages="fieldErrors.leg"
          />
        </v-col>
      </v-row>
    </template>

    <v-row dense>
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="form.match_date"
          label="Data e hora"
          type="datetime-local"
          :error-messages="fieldErrors.match_date"
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
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-select
          v-model="form.status"
          :items="GAME_STATUS_OPTIONS"
          item-title="title"
          item-value="value"
          label="Status"
          :error-messages="fieldErrors.status"
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-text-field
          v-model="form.home_score"
          label="Gols mandante"
          type="number"
          min="0"
          :error-messages="fieldErrors.home_score"
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-text-field
          v-model="form.away_score"
          label="Gols visitante"
          type="number"
          min="0"
          :error-messages="fieldErrors.away_score"
        />
      </v-col>
    </v-row>
  </FormDialog>
</template>
