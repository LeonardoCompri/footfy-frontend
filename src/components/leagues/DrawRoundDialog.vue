<script setup lang="ts">
import { computed } from 'vue'
import type { DrawConfirmation } from './leagueDraw'
import { manualGamesLabel } from './leagueDraw'

const props = defineProps<{
  modelValue: boolean
  round: number
  confirmation: DrawConfirmation
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const confirmText = computed(() =>
  props.confirmation.manualTotal > 0 ? 'Apagar e sortear' : `Sortear rodada ${props.round}`,
)

const limits = computed(() => [
  'Dá para mudar data, estádio e status e inverter o mando.',
  'Não dá para criar ou excluir partidas de rodada, nem mudar a rodada ou o grupo.',
  props.confirmation.hasReturnLeg
    ? 'A troca de times quase nunca é possível, e no returno os confrontos seguem o turno.'
    : 'A troca de times quase nunca é possível.',
  'Não dá para adicionar times à liga.',
  'A estrutura do Regulamento (grupos e turnos) fica travada.',
])

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
  close()
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="520" scrollable @update:model-value="close">
    <v-card data-test="draw-confirm-dialog">
      <v-card-title class="text-wrap">Sortear rodada {{ round }}</v-card-title>
      <v-card-text>
        <template v-if="confirmation.manualTotal > 0">
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
            data-test="draw-confirm-manual"
          >
            A liga tem {{ manualGamesLabel(confirmation.manualTotal) }}. Elas serão apagadas antes
            do sorteio.
          </v-alert>
          <v-alert
            v-if="confirmation.manualWithResults > 0"
            type="error"
            variant="flat"
            density="compact"
            class="mb-4"
            data-test="draw-confirm-manual-results"
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

        <template v-if="confirmation.firstRound">
          <p class="mb-2">Depois do sorteio, a edição das partidas fica limitada:</p>
          <ul class="pl-6" data-test="draw-confirm-limits">
            <li v-for="item in limits" :key="item" class="mb-1">{{ item }}</li>
          </ul>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn
          :color="confirmation.manualTotal > 0 ? 'error' : 'primary'"
          variant="flat"
          data-test="draw-confirm-submit"
          @click="confirm"
        >
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
