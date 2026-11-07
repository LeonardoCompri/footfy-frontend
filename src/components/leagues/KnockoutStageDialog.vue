<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { leaguesService } from '@/services/api/leagues.service'
import { GAME_LEG_OPTIONS } from '@/types/game'
import type {
  KnockoutPreview,
  KnockoutPreviewLeg,
  KnockoutPreviewTeam,
  KnockoutPreviewTie,
} from '@/types/leagueKnockout'
import {
  cancelledGroupGamesLabel,
  manualPhaseGamesLabel,
  type KnockoutConfirmation,
} from './leagueKnockout'

const props = defineProps<{
  modelValue: boolean
  leagueId: number
  title: string
  confirmation: KnockoutConfirmation
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const preview = ref<KnockoutPreview | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let requestId = 0

const replacing = computed(() => props.confirmation.manualTotal > 0)
const sections = computed(() => {
  const data = preview.value
  if (!data) return []
  return [
    { key: data.stage.key, title: data.stage.label, ties: data.ties },
    ...(data.third_place
      ? [{ key: '3P', title: 'Disputa de 3º lugar', ties: [data.third_place] }]
      : []),
  ]
})

async function load() {
  const current = ++requestId
  loading.value = true
  error.value = null
  preview.value = null
  try {
    const data = await leaguesService.knockoutPreview(props.leagueId)
    if (current === requestId) preview.value = data
  } catch (err) {
    if (current === requestId) error.value = extractErrorMessage(err)
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) load()
  },
  { immediate: true },
)

function teamName(team: KnockoutPreviewTeam | null): string {
  return team ? team.nickname || team.name : 'A definir'
}

function teamOf(tie: KnockoutPreviewTie, teamId: number): string {
  if (tie.home_team?.id === teamId) return teamName(tie.home_team)
  if (tie.away_team?.id === teamId) return teamName(tie.away_team)
  return 'A definir'
}

function legTitle(leg: KnockoutPreviewLeg): string {
  return GAME_LEG_OPTIONS.find((option) => option.value === leg.leg)?.title ?? 'Jogo único'
}

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  if (!preview.value) return
  emit('confirm')
  close()
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="560" scrollable @update:model-value="close">
    <v-card data-test="knockout-dialog">
      <v-card-title class="text-wrap">{{ title }}</v-card-title>
      <v-card-text>
        <v-alert
          v-if="confirmation.firstStage"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
          data-test="knockout-dialog-lock"
        >
          Depois de gerar, os resultados da fase de grupos não poderão mais ser alterados, inclusive
          partidas canceladas.
          <span v-if="confirmation.cancelledGroupGames > 0" data-test="knockout-dialog-cancelled">
            {{ cancelledGroupGamesLabel(confirmation.cancelledGroupGames) }}
          </span>
        </v-alert>
        <template v-if="replacing">
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
            data-test="knockout-dialog-manual"
          >
            A liga tem {{ manualPhaseGamesLabel(confirmation.manualTotal) }}.
            {{ confirmation.manualTotal === 1 ? 'Ela será apagada' : 'Elas serão apagadas' }} antes
            de gerar o mata-mata.
          </v-alert>
          <v-alert
            v-if="confirmation.manualWithResults > 0"
            type="error"
            variant="flat"
            density="compact"
            class="mb-4"
            data-test="knockout-dialog-manual-results"
          >
            <strong>
              {{
                confirmation.manualWithResults === 1
                  ? '1 delas tem resultado ou eventos, que também serão perdidos.'
                  : `${confirmation.manualWithResults} delas têm resultado ou eventos, que também serão perdidos.`
              }}
            </strong>
          </v-alert>
        </template>

        <div v-if="loading" class="d-flex justify-center py-6" data-test="knockout-dialog-loading">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          density="compact"
          data-test="knockout-dialog-error"
        >
          {{ error }}
        </v-alert>
        <template v-else-if="preview">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Confrontos pela classificação atual. O mandante de cada jogo aparece primeiro; o melhor
            colocado manda o jogo único ou a volta.
          </p>
          <section
            v-for="section in sections"
            :key="section.key"
            class="mb-4"
            data-test="knockout-dialog-section"
          >
            <h3 class="text-subtitle-2 font-weight-bold mb-2">{{ section.title }}</h3>
            <v-list density="compact" class="py-0" border rounded>
              <v-list-item
                v-for="tie in section.ties"
                :key="tie.tie_key"
                class="py-2"
                data-test="knockout-dialog-tie"
              >
                <div class="text-caption text-medium-emphasis">{{ tie.tie_key }}</div>
                <div class="font-weight-medium text-wrap" data-test="knockout-dialog-labels">
                  {{ tie.home_label }} × {{ tie.away_label }}
                </div>
                <div class="text-body-2 text-wrap">
                  {{ teamName(tie.home_team) }} × {{ teamName(tie.away_team) }}
                </div>
                <div
                  v-for="leg in tie.legs"
                  :key="leg.leg ?? 0"
                  class="text-caption text-medium-emphasis text-wrap"
                  data-test="knockout-dialog-leg"
                >
                  {{ legTitle(leg) }}: {{ teamOf(tie, leg.home_team_id) }} ×
                  {{ teamOf(tie, leg.away_team_id) }}
                </div>
              </v-list-item>
            </v-list>
          </section>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn
          :color="replacing ? 'error' : 'primary'"
          variant="flat"
          :disabled="!preview"
          data-test="knockout-dialog-confirm"
          @click="confirm"
        >
          {{ replacing ? 'Apagar e gerar' : 'Confirmar e gerar' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
