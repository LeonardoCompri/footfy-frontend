<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { cpfDigits, formatCpf } from './format'

// Campo de CPF com máscara só visual: exibe 000.000.000-00, mas o v-model carrega só os dígitos.
const props = defineProps<{ modelValue: string | null; required?: boolean }>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const display = ref(formatCpf(props.modelValue))
const field = ref<{ $el: HTMLElement } | null>(null)
let lastInputType = ''

const digitsOf = (value: string) => value.replace(/\D/g, '')

// Rules do Vuetify recebem o texto exibido (com máscara), por isso conta só os dígitos.
const rules = [
  (value: string) => {
    const length = digitsOf(value ?? '').length
    if (length === 0) return !props.required || 'Campo obrigatório.'
    return length === 11 || 'O CPF deve ter 11 dígitos.'
  },
]

// Valor vindo de fora: CPF salvo com pontuação volta só com dígitos (o backend exige size:11) e
// resets do dialog (reabrindo com outro registro) atualizam a exibição.
watch(
  () => props.modelValue,
  (value) => {
    if (value && value !== cpfDigits(value)) emit('update:modelValue', cpfDigits(value))
    if (cpfDigits(value) !== cpfDigits(display.value)) display.value = formatCpf(value)
  },
  { immediate: true },
)

// O tipo da edição (apagar para trás/para frente) vem do evento nativo, antes do v-text-field emitir.
onMounted(() => {
  field.value?.$el.addEventListener('input', (e) => (lastInputType = (e as InputEvent).inputType ?? ''), true)
})

// Posição no texto formatado logo depois do n-ésimo dígito.
function caretAfterDigits(formatted: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!) && ++seen === count) return i + 1
  }
  return formatted.length
}

async function handleUpdate(value: string) {
  const input = field.value?.$el.querySelector('input')
  const previous = display.value
  const caret = input?.selectionStart ?? value.length
  let digits = digitsOf(value)
  let digitsBeforeCaret = digitsOf(value.slice(0, caret)).length

  // Apagou só um separador ("." ou "-"): apaga o dígito vizinho, senão a máscara o recolocaria.
  if (digits === digitsOf(previous) && value.length < previous.length) {
    if (lastInputType === 'deleteContentBackward' && digitsBeforeCaret > 0) {
      digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret)
      digitsBeforeCaret--
    } else if (lastInputType === 'deleteContentForward') {
      digits = digits.slice(0, digitsBeforeCaret) + digits.slice(digitsBeforeCaret + 1)
    }
  }
  // Passaria de 11 dígitos: recusa a edição (como um maxlength) em vez de cortar o fim do CPF.
  if (digits.length > 11) {
    const inserted = digits.length - digitsOf(previous).length
    digits = digitsOf(previous)
    digitsBeforeCaret = Math.max(0, digitsBeforeCaret - inserted)
  }
  lastInputType = ''

  emit('update:modelValue', digits)
  const formatted = formatCpf(digits)
  // Formatado igual ao atual (letra descartada, edição recusada): sem mudança o Vue não
  // re-renderiza e o texto digitado ficaria no input. Aplica o texto cru e restaura no próximo tick.
  if (formatted === previous) {
    display.value = value
    await nextTick()
  }
  display.value = formatted
  await nextTick()
  // Mantém o cursor onde o usuário estava, em vez de pular para o fim a cada reformatação.
  const position = caretAfterDigits(formatted, digitsBeforeCaret)
  input?.setSelectionRange(position, position)
}
</script>

<template>
  <v-text-field
    ref="field"
    :model-value="display"
    label="CPF"
    placeholder="000.000.000-00"
    inputmode="numeric"
    :rules="rules"
    @update:model-value="handleUpdate"
  />
</template>
