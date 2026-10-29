<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title?: string
  message?: string
  // Texto do botão de confirmação (padrão "Excluir").
  confirmText?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
  close()
}

function cancel() {
  emit('cancel')
  close()
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="420" @update:model-value="close">
    <v-card>
      <v-card-title>{{ title ?? 'Confirmar ação' }}</v-card-title>
      <v-card-text>{{ message ?? 'Tem certeza que deseja continuar?' }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancelar</v-btn>
        <v-btn color="error" variant="flat" @click="confirm">{{ confirmText ?? 'Excluir' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
