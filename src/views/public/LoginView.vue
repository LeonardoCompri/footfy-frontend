<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const document = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

const requiredRule = (value: string) => !!value || 'Campo obrigatório.'

async function handleSubmit() {
  loading.value = true
  errorMessage.value = null
  try {
    await authStore.login({ document: document.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/admin'
    router.push(redirect)
  } catch (err) {
    const axiosErr = err as AxiosError<ApiErrorResponse>
    if (axiosErr.response?.status === 401) {
      errorMessage.value = 'CPF ou senha inválidos.'
    } else {
      errorMessage.value = axiosErr.response?.data?.message ?? 'Não foi possível fazer login.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card elevation="4">
          <v-card-title class="text-h5 text-center py-4">Entrar</v-card-title>
          <v-card-text>
            <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
              {{ errorMessage }}
            </v-alert>
            <v-form @submit.prevent="handleSubmit">
              <v-text-field
                v-model="document"
                label="CPF"
                placeholder="000.000.000-00"
                :rules="[requiredRule]"
                class="mb-2"
              />
              <v-text-field
                v-model="password"
                label="Senha"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                :rules="[requiredRule]"
                class="mb-2"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-btn type="submit" color="primary" block size="large" :loading="loading">
                Entrar
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
