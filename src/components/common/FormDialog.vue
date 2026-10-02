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
      <v-form @submit.prevent="emit('submit')">
        <v-card-text>
          <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4" data-test="form-error">
            {{ errorMessage }}
          </v-alert>
          <slot />
        </v-card-text>
        <v-card-actions>
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
