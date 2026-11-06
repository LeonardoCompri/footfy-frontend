<script setup lang="ts">
import { useDisplay } from 'vuetify'
import type { SubmitEventPromise } from 'vuetify'

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

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event
  if (valid) emit('submit')
}
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
        <slot name="title">
          <span class="text-truncate">{{ title }}</span>
        </slot>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-form class="form-dialog__form" @submit.prevent="handleSubmit">
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
