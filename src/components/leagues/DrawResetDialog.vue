<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const CONFIRM_WORD = 'REINICIAR'

const props = defineProps<{
  modelValue: boolean
  drawnRounds: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const typed = ref('')
const matches = computed(() => typed.value.trim().toUpperCase() === CONFIRM_WORD)

watch(
  () => props.modelValue,
  (open) => {
    if (open) typed.value = ''
  },
)

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  if (!matches.value) return
  emit('confirm')
  close()
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="close">
    <v-card data-test="draw-reset-dialog">
      <v-card-title class="text-wrap">Reiniciar sorteio</v-card-title>
      <v-form @submit.prevent="confirm">
        <v-card-text>
          <v-alert type="error" variant="tonal" class="mb-4">
            {{
              drawnRounds === 1
                ? 'A rodada sorteada será apagada, com todas as partidas dos grupos.'
                : `As ${drawnRounds} rodadas sorteadas serão apagadas, com todas as partidas dos grupos.`
            }}
            A ação não pode ser desfeita.
          </v-alert>
          <p class="mb-4">
            Os grupos continuam montados e o Regulamento volta a ficar editável. Digite
            <strong>{{ CONFIRM_WORD }}</strong> para confirmar.
          </p>
          <v-text-field
            v-model="typed"
            label="Confirmação"
            autocomplete="off"
            autofocus
            data-test="draw-reset-input"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="close">Cancelar</v-btn>
          <v-btn
            type="submit"
            color="error"
            variant="flat"
            :disabled="!matches"
            data-test="draw-reset-confirm"
          >
            Reiniciar sorteio
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
