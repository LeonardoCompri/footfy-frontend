<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AxiosError } from 'axios'
import { extractErrorMessage } from '@/composables/useCrud'
import { leaguesService } from '@/services/api/leagues.service'
import type { ApiErrorResponse } from '@/types/api'

const props = defineProps<{
  modelValue: boolean
  league: { id: number; name: string } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  deleted: [leagueId: number]
}>()

const step = ref<1 | 2>(1)
const password = ref('')
const errorMessage = ref<string | null>(null)
const loading = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    step.value = 1
    password.value = ''
    errorMessage.value = null
  },
)

function close() {
  emit('update:modelValue', false)
}

async function confirmDelete() {
  if (!props.league || !password.value) return
  loading.value = true
  errorMessage.value = null
  try {
    await leaguesService.removeWithPassword(props.league.id, password.value)
    emit('deleted', props.league.id)
    close()
  } catch (err) {
    const response = (err as AxiosError<ApiErrorResponse>).response
    if (response?.status === 422) {
      errorMessage.value = response.data?.errors?.password?.[0] ?? 'Senha incorreta.'
    } else if (response?.status === 429) {
      errorMessage.value = 'Muitas tentativas. Aguarde um minuto.'
    } else {
      errorMessage.value = extractErrorMessage(err)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="close">
    <v-card data-test="league-delete-dialog">
      <v-card-title class="text-wrap">Excluir liga {{ league?.name }}</v-card-title>
      <template v-if="step === 1">
        <v-card-text>
          <v-alert type="warning" variant="tonal" class="mb-4">
            A exclusão é imediata e não depende do botão Salvar do formulário.
          </v-alert>
          <p class="mb-2">Serão apagados todos os dados da liga:</p>
          <ul class="pl-6 mb-2">
            <li>partidas e súmulas;</li>
            <li>estádios da liga;</li>
            <li>vínculos dos times e dos usuários com a liga.</li>
          </ul>
          <p>Times, jogadores, comissão técnica e usuários continuam no sistema.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="close">Cancelar</v-btn>
          <v-btn color="error" variant="flat" data-test="league-delete-continue" @click="step = 2">
            Continuar
          </v-btn>
        </v-card-actions>
      </template>

      <v-form v-else @submit.prevent="confirmDelete">
        <v-card-text>
          <p class="mb-4">Digite sua senha para confirmar a exclusão.</p>
          <v-text-field
            v-model="password"
            label="Senha"
            type="password"
            autocomplete="current-password"
            autofocus
            :error-messages="errorMessage ?? undefined"
            data-test="league-delete-password"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="step = 1">Voltar</v-btn>
          <v-btn
            type="submit"
            color="error"
            variant="flat"
            :loading="loading"
            :disabled="!password"
            data-test="league-delete-confirm"
          >
            Excluir liga
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
