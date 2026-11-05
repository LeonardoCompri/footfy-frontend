<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AxiosError } from 'axios'
import { extractErrorMessage } from '@/composables/useCrud'
import type { ApiErrorResponse } from '@/types/api'

// Exclusão definitiva em 2 passos: aviso do que cai junto e, depois, a senha do usuário.
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    confirmText: string
    removed: string[]
    kept: string
    request: (password: string) => Promise<unknown>
    warning?: string
    // Aviso ainda carregando (ex.: buscando as ligas): segura o "Continuar".
    loading?: boolean
  }>(),
  { warning: 'A exclusão é imediata e não pode ser desfeita.', loading: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  deleted: []
}>()

const step = ref<1 | 2>(1)
const password = ref('')
const errorMessage = ref<string | null>(null)
const deleting = ref(false)

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
  if (!password.value) return
  deleting.value = true
  errorMessage.value = null
  try {
    await props.request(password.value)
    emit('deleted')
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
    deleting.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="close">
    <v-card data-test="password-delete-dialog">
      <v-card-title class="text-wrap">{{ title }}</v-card-title>
      <template v-if="step === 1">
        <v-card-text>
          <v-alert type="warning" variant="tonal" class="mb-4">{{ warning }}</v-alert>
          <slot />
          <p class="mb-2">Serão apagados:</p>
          <ul class="pl-6 mb-2" data-test="password-delete-removed">
            <li v-for="item in removed" :key="item">{{ item }}</li>
          </ul>
          <p>{{ kept }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="close">Cancelar</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="loading"
            :disabled="loading"
            data-test="password-delete-continue"
            @click="step = 2"
          >
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
            data-test="password-delete-password"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="step = 1">Voltar</v-btn>
          <v-btn
            type="submit"
            color="error"
            variant="flat"
            :loading="deleting"
            :disabled="!password"
            data-test="password-delete-confirm"
          >
            {{ confirmText }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
