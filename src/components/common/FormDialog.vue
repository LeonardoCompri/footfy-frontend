<script setup lang="ts">
import { useDisplay } from 'vuetify'

defineProps<{
  modelValue: boolean
  title: string
  loading?: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: []
}>()

const { xs } = useDisplay()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    :fullscreen="xs"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="text-truncate">{{ title }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <!-- O v-form fica entre o v-card e o v-card-text, o que quebra o layout `scrollable` do
           v-dialog: por isso o form é flex column e só o conteúdo rola. Assim as ações ficam
           fixas no rodapé (no fullscreen do mobile, no fim da tela) e não se movem quando um
           campo muda de altura no blur — senão o primeiro toque em Salvar se perde. -->
      <v-form class="form-dialog__form" @submit.prevent="emit('submit')">
        <v-card-text class="form-dialog__content" data-test="form-content">
          <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4" data-test="form-error">
            {{ errorMessage }}
          </v-alert>
          <slot />
        </v-card-text>
        <v-divider />
        <v-card-actions data-test="form-actions">
          <v-spacer />
          <v-btn variant="text" @click="emit('update:modelValue', false)">Cancelar</v-btn>
          <v-btn type="submit" color="primary" variant="flat" :loading="loading" data-test="form-submit">
            Salvar
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.form-dialog__form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.form-dialog__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>
