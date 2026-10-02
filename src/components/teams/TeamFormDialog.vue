<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { teamsService } from '@/services/api/teams.service'
import type { Team, TeamPayload } from '@/types/team'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  leagueId: number
  team?: Team | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [team: Team]
}>()

const { loading, errorMessage, fieldErrors, save } = useCrud<Team, TeamPayload>(teamsService)
const snackbar = useSnackbar()

const form = reactive<TeamPayload>({ name: '', nickname: null, logo: null })
const isEditing = computed(() => !!props.team)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    form.name = props.team?.name ?? ''
    form.nickname = props.team?.nickname ?? null
    form.logo = null
  },
  { immediate: true },
)

async function handleSubmit() {
  const result = await save(form, props.team?.id)
  if (!result) return

  if (!isEditing.value) {
    // POST /teams não recebe liga: o vínculo com a liga ativa é feito logo em seguida,
    // senão o time recém-criado não aparece na listagem escopada.
    try {
      await teamsService.attachLeagues(result.id, [props.leagueId])
    } catch {
      snackbar.error('Time criado, mas não foi possível vinculá-lo à liga atual.')
      emit('update:modelValue', false)
      return
    }
  }

  snackbar.success(isEditing.value ? 'Time atualizado com sucesso.' : 'Time criado com sucesso.')
  emit('saved', result)
  emit('update:modelValue', false)
}
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar time' : 'Novo time'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-text-field v-model="form.name" label="Nome" :error-messages="fieldErrors.name" data-test="team-name" />
    <v-text-field v-model="form.nickname" label="Apelido" :error-messages="fieldErrors.nickname" />
    <div class="d-flex align-center ga-3">
      <v-avatar v-if="team?.logo" :image="team.logo" size="48" rounded="lg" />
      <v-file-input
        v-model="form.logo"
        :label="team?.logo ? 'Trocar escudo' : 'Escudo'"
        accept="image/png, image/jpeg, image/webp"
        prepend-icon=""
        prepend-inner-icon="mdi-image"
        hint="PNG, JPG ou WEBP de até 2 MB."
        persistent-hint
        :error-messages="fieldErrors.logo"
      />
    </div>
  </FormDialog>
</template>
