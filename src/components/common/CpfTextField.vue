<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { cpfDigits, formatCpf } from './format'

// Campo de CPF com máscara só visual: exibe 000.000.000-00, mas o v-model carrega só os dígitos.
const props = defineProps<{ modelValue: string | null }>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const display = ref(formatCpf(props.modelValue))

// Resets vindos de fora (dialog reabrindo com outro registro).
watch(
  () => props.modelValue,
  (value) => {
    if (cpfDigits(value) !== cpfDigits(display.value)) display.value = formatCpf(value)
  },
)

async function handleUpdate(value: string) {
  const formatted = formatCpf(value)
  emit('update:modelValue', cpfDigits(value))
  if (formatted !== display.value) {
    display.value = formatted
    return
  }
  // Letra ou 12º dígito descartado: o formatado é igual ao atual, então o Vue não re-renderiza
  // e o caractere ficaria visível no input. Aplica o texto cru e restaura no próximo tick.
  display.value = value
  await nextTick()
  display.value = formatted
}
</script>

<template>
  <v-text-field
    :model-value="display"
    label="CPF"
    placeholder="000.000.000-00"
    inputmode="numeric"
    @update:model-value="handleUpdate"
  />
</template>
