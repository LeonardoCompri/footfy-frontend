<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { playersService } from '@/services/api/players.service'
import type { SelectOption } from '@/types/api'
import type { Player, PlayerPayload } from '@/types/player'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  teamId: number
  player?: Player | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [player: Player]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<Player, PlayerPayload>(playersService)
const snackbar = useSnackbar()
const positions = ref<SelectOption[]>([])

const form = reactive<PlayerPayload>({
  team_id: null,
  name: '',
  position: null,
  number: null,
  birth_date: null,
  document: null,
})

const isEditing = computed(() => !!props.player)

// Jogadores antigos podem ter posição em texto livre: mantém o valor atual selecionável.
const positionItems = computed(() => {
  const current = props.player?.position
  if (!current || positions.value.some((p) => p.value === current)) return positions.value
  return [...positions.value, { value: current, title: current }]
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    form.team_id = props.teamId
    form.name = props.player?.name ?? ''
    form.position = props.player?.position ?? null
    form.number = props.player?.number ?? null
    form.birth_date = props.player?.birth_date?.slice(0, 10) ?? null
    form.document = props.player?.document ?? null
  },
  { immediate: true },
)

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

async function handleSubmit() {
  // O time nunca é perguntado: vem do contexto da tela (time aberto).
  const payload = { ...form, team_id: props.teamId, number: toNullableNumber(form.number) }
  const result = await save(payload, props.player?.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Jogador atualizado com sucesso.' : 'Jogador criado com sucesso.')
    emit('saved', result)
    emit('update:modelValue', false)
  }
}

onMounted(async () => {
  try {
    positions.value = await playersService.positions()
  } catch {
    positions.value = []
  }
})
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar jogador' : 'Novo jogador'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-text-field v-model="form.name" label="Nome" :error-messages="fieldErrors.name" data-test="player-name" />
    <v-row dense>
      <v-col cols="12" sm="8">
        <v-select
          v-model="form.position"
          :items="positionItems"
          item-title="title"
          item-value="value"
          label="Posição"
          clearable
          :error-messages="fieldErrors.position"
          data-test="player-position"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model.number="form.number"
          label="Número"
          type="number"
          min="0"
          :error-messages="fieldErrors.number"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="form.birth_date"
          label="Data de nascimento"
          type="date"
          :error-messages="fieldErrors.birth_date"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="form.document"
          label="CPF"
          maxlength="11"
          :error-messages="fieldErrors.document"
        />
      </v-col>
    </v-row>
  </FormDialog>
</template>
