<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { stadiumsService } from '@/services/api/stadiums.service'
import type { Stadium, StadiumPayload } from '@/types/stadium'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  leagueId: number
  stadium?: Stadium | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [stadium: Stadium]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<Stadium, StadiumPayload>(stadiumsService)
const snackbar = useSnackbar()

const form = reactive<StadiumPayload>({ league_id: 0, name: '', city: '', capacity: 0 })
const isEditing = computed(() => !!props.stadium)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    form.name = props.stadium?.name ?? ''
    form.city = props.stadium?.city ?? ''
    form.capacity = props.stadium?.capacity ?? 0
  },
  { immediate: true },
)

async function handleSubmit() {
  // Estádio pertence à liga ativa: `league_id` vem do contexto, não do formulário.
  const result = await save({ ...form, league_id: props.leagueId }, props.stadium?.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Estádio atualizado com sucesso.' : 'Estádio criado com sucesso.')
    emit('saved', result)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar estádio' : 'Novo estádio'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-text-field v-model="form.name" label="Nome" :error-messages="fieldErrors.name" data-test="stadium-name" />
    <v-text-field v-model="form.city" label="Cidade" :error-messages="fieldErrors.city" />
    <v-text-field
      v-model.number="form.capacity"
      label="Capacidade"
      type="number"
      min="0"
      :error-messages="fieldErrors.capacity"
    />
  </FormDialog>
</template>
