<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { extractErrorMessage, useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { leaguesService } from '@/services/api/leagues.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import type { League, LeagueFormat, LeaguePayload } from '@/types/championship'
import {
  FIXTURE_MODE_LABELS,
  GROUP_LEGS_LABELS,
  KNOCKOUT_LEGS_LABELS,
  KNOCKOUT_SIZE_LABELS,
  KNOCKOUT_SIZES,
  KNOCKOUT_TIEBREAKER_OPTIONS,
  MAX_GROUPS,
  type FixtureMode,
  type LeagueGroups,
  type LeagueRules,
  type Legs,
} from '@/types/leagueRules'
import {
  hasGroupStage,
  hasKnockout,
  rulesSummary,
  toRulesForm,
  toRulesPayload,
  validateRules,
  type LeagueRulesForm,
} from '@/components/leagues/leagueRules'
import { groupMap, hasAssignedTeams } from '@/components/leagues/leagueGroups'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import LeagueGroupsPanel from '@/components/leagues/LeagueGroupsPanel.vue'
import TiebreakerList from '@/components/leagues/TiebreakerList.vue'

const leagueContext = useLeagueContextStore()
const leagueId = leagueContext.activeLeagueId as number
const snackbar = useSnackbar()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<
  League,
  LeaguePayload | LeagueRules
>(leaguesService)

const initializing = ref(true)
const league = ref<League | null>(null)
const groups = ref<LeagueGroups | null>(null)
const groupsError = ref<string | null>(null)
const form = reactive<LeagueRulesForm>(toRulesForm({}))
const submitted = ref(false)
const confirmRegroup = ref(false)

const numberOptions = (max: number) =>
  Array.from({ length: max }, (_, index) => ({ value: index + 1, title: String(index + 1) }))
const legsOptions = (labels: Record<Legs, string>) =>
  ([1, 2] as Legs[]).map((value) => ({ value, title: labels[value] }))

const fixtureModeOptions = (Object.keys(FIXTURE_MODE_LABELS) as FixtureMode[]).map((value) => ({
  value,
  title: FIXTURE_MODE_LABELS[value],
}))
const groupsCountOptions = numberOptions(MAX_GROUPS)
const qualifierOptions = numberOptions(16)
const groupLegsOptions = legsOptions(GROUP_LEGS_LABELS)
const knockoutLegsOptions = legsOptions(KNOCKOUT_LEGS_LABELS)
const knockoutSizeOptions = KNOCKOUT_SIZES.map((value) => ({
  value,
  title: KNOCKOUT_SIZE_LABELS[value],
}))
const knockoutTiebreakerOptions = KNOCKOUT_TIEBREAKER_OPTIONS.map(({ value, title }) => ({
  value,
  title,
}))

const format = computed<LeagueFormat>(() => league.value?.format ?? 'round_robin')
const locked = computed(() => groups.value?.locked ?? false)
const teamsCount = computed(() =>
  groups.value
    ? groups.value.groups.reduce((total, group) => total + group.teams.length, 0) +
      groups.value.unassigned.length
    : null,
)
const payload = computed(() => toRulesPayload(form, format.value))
const localErrors = computed(() =>
  validateRules(payload.value, {
    format: format.value,
    teamsCount: teamsCount.value,
    saved: league.value ?? undefined,
  }),
)
const summary = computed(() => rulesSummary(payload.value, format.value, teamsCount.value))
const drawRequired = computed(() => format.value === 'hybrid' && form.fixture_mode === 'draw')
const groupsOutdated = computed(
  () =>
    !!league.value &&
    (payload.value.fixture_mode !== (league.value.fixture_mode ?? 'manual') ||
      payload.value.groups_count !== (league.value.groups_count ?? 1)),
)
const subtitle = computed(() =>
  [league.value?.name, LEAGUE_FORMAT_LABELS[format.value]].filter(Boolean).join(' · '),
)

function fieldError(field: keyof LeagueRules): string[] {
  const local = submitted.value ? localErrors.value[field] : undefined
  if (local) return [local]
  return Object.entries(fieldErrors.value)
    .filter(([key]) => key === field || key.startsWith(`${field}.`))
    .flatMap(([, messages]) => messages)
}

function requiredLabel(label: string): string {
  return drawRequired.value ? `${label}*` : label
}

function applyLeague(data: League) {
  league.value = data
  Object.assign(form, toRulesForm(data))
  submitted.value = false
}

async function loadGroups() {
  groupsError.value = null
  try {
    groups.value = await leaguesService.groups(leagueId)
  } catch (err) {
    groupsError.value = extractErrorMessage(err)
  }
}

onMounted(async () => {
  try {
    const [data] = await Promise.all([fetchOne(leagueId), loadGroups()])
    if (data) applyLeague(data)
  } finally {
    initializing.value = false
  }
})

function handleSubmit() {
  submitted.value = true
  if (Object.keys(localErrors.value).length) return

  const groupsCountChanged = payload.value.groups_count !== (league.value?.groups_count ?? 1)
  if (groupsCountChanged && groups.value && hasAssignedTeams(groupMap(groups.value))) {
    confirmRegroup.value = true
    return
  }
  persist()
}

async function persist() {
  const result = await save(payload.value, leagueId)
  if (!result) return
  applyLeague(result)
  await loadGroups()
  leagueContext.loadLeagues(true).catch(() => undefined)
  snackbar.success('Regulamento salvo com sucesso.')
}
</script>

<template>
  <div>
    <PageHeader title="Regulamento" :subtitle="subtitle" />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4" data-test="rules-error">
      {{ errorMessage }}
    </v-alert>

    <v-card v-if="initializing">
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
    </v-card>

    <template v-else-if="league">
      <v-form @submit.prevent="handleSubmit">
        <v-alert v-if="locked" type="info" variant="tonal" class="mb-4" data-test="rules-locked">
          A liga já tem rodadas sorteadas: formato, tabela de jogos, número de grupos e turnos não
          podem mais mudar.
        </v-alert>

        <v-card class="mb-4">
          <v-card-title class="text-wrap">Formato</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  :model-value="LEAGUE_FORMAT_LABELS[format]"
                  label="Formato"
                  readonly
                  prepend-inner-icon="mdi-lock-outline"
                  hint="Definido no cadastro do campeonato."
                  persistent-hint
                  data-test="rules-format"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.fixture_mode"
                  :items="fixtureModeOptions"
                  label="Tabela de jogos"
                  :disabled="locked || format === 'knockout'"
                  :error-messages="fieldError('fixture_mode')"
                  hint="No sorteio, as rodadas são geradas pelo sistema."
                  persistent-hint
                  data-test="rules-fixture-mode"
                />
              </v-col>
            </v-row>

            <v-alert
              v-if="format === 'knockout'"
              type="info"
              variant="tonal"
              density="compact"
              class="mt-4"
              data-test="rules-knockout-manual"
            >
              O sorteio não se aplica ao formato mata-mata: as partidas são cadastradas manualmente.
            </v-alert>

            <div class="d-flex align-start ga-2 mt-4" data-test="rules-summary">
              <v-icon icon="mdi-sitemap-outline" color="primary" class="mt-1" />
              <span class="text-body-1 font-weight-medium">{{ summary.steps.join(' → ') }}</span>
            </div>
            <v-alert
              v-if="summary.problem"
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-2"
              data-test="rules-summary-problem"
            >
              {{ summary.problem }}
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card v-if="hasGroupStage(format)" class="mb-4" data-test="rules-group-stage">
          <v-card-title class="text-wrap">
            {{ format === 'hybrid' ? 'Fase de grupos' : 'Pontos corridos' }}
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col v-if="format === 'hybrid'" cols="12" sm="4">
                <v-select
                  v-model="form.groups_count"
                  :items="groupsCountOptions"
                  label="Número de grupos"
                  :disabled="locked"
                  :error-messages="fieldError('groups_count')"
                  data-test="rules-groups-count"
                />
              </v-col>
              <v-col cols="12" :sm="format === 'hybrid' ? 4 : 6">
                <v-select
                  v-model="form.group_legs"
                  :items="groupLegsOptions"
                  label="Turnos"
                  :disabled="locked"
                  :error-messages="fieldError('group_legs')"
                  data-test="rules-group-legs"
                />
              </v-col>
              <v-col v-if="format === 'hybrid'" cols="12" sm="4">
                <v-select
                  v-model="form.qualifiers_per_group"
                  :items="qualifierOptions"
                  :label="requiredLabel('Classificados por grupo')"
                  clearable
                  :error-messages="fieldError('qualifiers_per_group')"
                  data-test="rules-qualifiers"
                />
              </v-col>
            </v-row>

            <TiebreakerList
              v-model="form.tiebreakers"
              :error-messages="fieldError('tiebreakers')"
              class="mt-4"
            />
          </v-card-text>
        </v-card>

        <v-card v-if="hasKnockout(format)" class="mb-4" data-test="rules-knockout">
          <v-card-title class="text-wrap">Mata-mata</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.knockout_size"
                  :items="knockoutSizeOptions"
                  :label="requiredLabel('Mata-mata começa em')"
                  clearable
                  :error-messages="fieldError('knockout_size')"
                  data-test="rules-knockout-size"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.knockout_tiebreakers"
                  :items="knockoutTiebreakerOptions"
                  :label="requiredLabel('Empate no agregado')"
                  clearable
                  hint="Gol fora só vale com ida e volta."
                  persistent-hint
                  :error-messages="fieldError('knockout_tiebreakers')"
                  data-test="rules-knockout-tiebreakers"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.knockout_legs"
                  :items="knockoutLegsOptions"
                  :label="requiredLabel('Confrontos do mata-mata')"
                  clearable
                  :error-messages="fieldError('knockout_legs')"
                  data-test="rules-knockout-legs"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.final_legs"
                  :items="knockoutLegsOptions"
                  :label="requiredLabel('Final')"
                  clearable
                  :error-messages="fieldError('final_legs')"
                  data-test="rules-final-legs"
                />
              </v-col>
              <v-col cols="12">
                <v-switch
                  v-model="form.third_place"
                  label="Disputa de 3º lugar"
                  color="primary"
                  hint="Sempre em jogo único."
                  persistent-hint
                  inset
                  :error-messages="fieldError('third_place')"
                  data-test="rules-third-place"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <div class="d-flex justify-end mb-6">
          <v-btn
            type="submit"
            color="primary"
            prepend-icon="mdi-content-save"
            :loading="loading"
            data-test="rules-submit"
          >
            Salvar regulamento
          </v-btn>
        </div>
      </v-form>

      <v-alert
        v-if="groupsError"
        type="error"
        variant="tonal"
        class="mb-4"
        data-test="groups-load-error"
      >
        {{ groupsError }}
      </v-alert>

      <template v-if="groups?.fixture_mode === 'draw'">
        <v-alert
          v-if="groupsOutdated && !groups.locked"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
          data-test="groups-outdated"
        >
          Salve o regulamento para aplicar a mudança na montagem dos grupos.
        </v-alert>
        <LeagueGroupsPanel
          :league-id="leagueId"
          :data="groups"
          :disabled="groupsOutdated"
          @updated="groups = $event"
        />
      </template>
      <v-alert
        v-else-if="groups && payload.fixture_mode === 'draw'"
        type="info"
        variant="tonal"
        data-test="groups-pending"
      >
        Salve o regulamento para montar os grupos.
      </v-alert>
    </template>

    <ConfirmDialog
      v-model="confirmRegroup"
      title="Mudar o número de grupos"
      message="Ao salvar, a montagem atual dos grupos será apagada e os times voltam para Sem grupo. Deseja continuar?"
      confirm-text="Salvar"
      @confirm="persist"
    />
  </div>
</template>
