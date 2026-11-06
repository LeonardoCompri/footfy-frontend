<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import type { SelectOption } from '@/types/api'
import type {
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload,
} from '@/types/technicalCommitteeMember'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  teamId: number
  member?: TechnicalCommitteeMember | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [member: TechnicalCommitteeMember]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload
>(technicalCommitteeMembersService)
const snackbar = useSnackbar()
const roles = ref<SelectOption[]>([])

const form = reactive<TechnicalCommitteeMemberPayload>({
  team_id: null,
  name: '',
  role: '',
  birth_date: null,
})

const isEditing = computed(() => !!props.member)

const roleItems = computed(() => {
  const current = props.member?.role
  if (!current || roles.value.some((r) => r.value === current)) return roles.value
  return [...roles.value, { value: current, title: current }]
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    form.team_id = props.teamId
    form.name = props.member?.name ?? ''
    form.role = props.member?.role ?? ''
    form.birth_date = props.member?.birth_date?.slice(0, 10) ?? null
  },
  { immediate: true },
)

async function handleSubmit() {
  const result = await save({ ...form, team_id: props.teamId }, props.member?.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Membro atualizado com sucesso.' : 'Membro criado com sucesso.')
    emit('saved', result)
    emit('update:modelValue', false)
  }
}

onMounted(async () => {
  try {
    roles.value = await technicalCommitteeMembersService.roles()
  } catch {
    roles.value = []
  }
})
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar membro da comissão' : 'Novo membro da comissão'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-text-field v-model="form.name" label="Nome" :error-messages="fieldErrors.name" data-test="member-name" />
    <v-select
      v-model="form.role"
      :items="roleItems"
      item-title="title"
      item-value="value"
      label="Função"
      :error-messages="fieldErrors.role"
      data-test="member-role"
    />
    <v-text-field
      v-model="form.birth_date"
      label="Data de nascimento"
      type="date"
      :error-messages="fieldErrors.birth_date"
    />
  </FormDialog>
</template>
