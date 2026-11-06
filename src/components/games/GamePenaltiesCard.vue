<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AxiosError } from 'axios'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import type { ApiErrorResponse } from '@/types/api'
import type { Game, GamePenaltiesPayload } from '@/types/game'
import { penaltiesError, penaltiesPayload } from './gamePenalties'

const props = defineProps<{ game: Game }>()

const emit = defineEmits<{ saved: [game: Game] }>()

const snackbar = useSnackbar()

const home = ref<string | number | null>(null)
const away = ref<string | number | null>(null)
const localError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const errorMessage = ref<string | null>(null)
const busy = ref<'save' | 'clear' | null>(null)

const homeName = computed(
  () => props.game.homeTeam?.nickname || props.game.homeTeam?.name || 'Mandante',
)
const awayName = computed(
  () => props.game.awayTeam?.nickname || props.game.awayTeam?.name || 'Visitante',
)
const saved = computed(() => props.game.home_penalties != null || props.game.away_penalties != null)
const homeErrors = computed(() =>
  localError.value ? [localError.value] : (fieldErrors.value.home_penalties ?? []),
)
const awayErrors = computed(() =>
  localError.value ? [] : (fieldErrors.value.away_penalties ?? []),
)

watch(
  () => [props.game.id, props.game.home_penalties, props.game.away_penalties],
  () => {
    home.value = props.game.home_penalties ?? null
    away.value = props.game.away_penalties ?? null
    localError.value = null
    fieldErrors.value = {}
    errorMessage.value = null
  },
  { immediate: true },
)

function clearErrors() {
  localError.value = null
  fieldErrors.value = {}
  errorMessage.value = null
}

async function send(action: 'save' | 'clear', payload: GamePenaltiesPayload, success: string) {
  if (busy.value) return
  busy.value = action
  try {
    const game = await gamesService.updatePenalties(props.game.id, payload)
    snackbar.success(success)
    emit('saved', game)
  } catch (err) {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    const errors = axiosErr.response?.status === 422 ? (axiosErr.response.data?.errors ?? {}) : {}
    fieldErrors.value = errors
    errorMessage.value = Object.keys(errors).length ? null : extractErrorMessage(err)
  } finally {
    busy.value = null
  }
}

function save() {
  clearErrors()
  localError.value = penaltiesError(home.value, away.value)
  if (localError.value) return
  send('save', penaltiesPayload(home.value, away.value), 'Pênaltis salvos.')
}

function clear() {
  clearErrors()
  send('clear', { home_penalties: null, away_penalties: null }, 'Pênaltis removidos.')
}
</script>

<template>
  <v-card class="mb-4" data-test="game-penalties">
    <v-card-title class="text-subtitle-1 font-weight-bold">Disputa de pênaltis</v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-3">
        {{
          game.penalties_allowed
            ? 'O confronto terminou empatado depois dos critérios de desempate. Informe o resultado da disputa de pênaltis.'
            : 'O confronto não está mais empatado ou ainda não foi encerrado. Corrija ou limpe os pênaltis lançados.'
        }}
      </p>
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
      <form @submit.prevent="save">
        <v-row dense>
          <v-col cols="6">
            <v-text-field
              v-model="home"
              type="number"
              inputmode="numeric"
              min="0"
              max="99"
              :label="homeName"
              :error-messages="homeErrors"
              data-test="game-penalties-home"
              @update:model-value="clearErrors"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model="away"
              type="number"
              inputmode="numeric"
              min="0"
              max="99"
              :label="awayName"
              :error-messages="awayErrors"
              data-test="game-penalties-away"
              @update:model-value="clearErrors"
            />
          </v-col>
        </v-row>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            type="submit"
            color="primary"
            prepend-icon="mdi-content-save"
            :loading="busy === 'save'"
            :disabled="!!busy"
            data-test="game-penalties-save"
          >
            Salvar pênaltis
          </v-btn>
          <v-btn
            v-if="saved"
            variant="text"
            color="error"
            prepend-icon="mdi-close"
            :loading="busy === 'clear'"
            :disabled="!!busy"
            data-test="game-penalties-clear"
            @click="clear"
          >
            Limpar pênaltis
          </v-btn>
        </div>
      </form>
    </v-card-text>
  </v-card>
</template>
