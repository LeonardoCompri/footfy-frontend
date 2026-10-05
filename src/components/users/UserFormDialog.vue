<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { usersService } from '@/services/api/users.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { USER_ROLE_OPTIONS } from '@/types/user'
import type { User, UserPayload, UserRole } from '@/types/user'
import FormDialog from '@/components/common/FormDialog.vue'

const props = defineProps<{
  modelValue: boolean
  user?: User | null
  // Só master define papel (e cria usuário); admin edita apenas os dados básicos.
  canChangeRole: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [user: User]
}>()

const leagueContext = useLeagueContextStore()
const { loading, errorMessage, fieldErrors, save } = useCrud<User, UserPayload>(usersService)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.user)
const showPassword = ref(false)
const form = reactive({
  name: '',
  document: '',
  email: '' as string | null,
  password: '',
  role: 'admin' as UserRole,
  leagueIds: [] as number[],
})

const leagueItems = computed(() =>
  leagueContext.leagues.map((league) => ({
    id: league.id,
    title: league.championship ? `${league.name} (${league.championship.name})` : league.name,
  })),
)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    showPassword.value = false
    form.name = props.user?.name ?? ''
    form.document = props.user?.document ?? ''
    form.email = props.user?.email ?? ''
    form.password = ''
    form.role = (props.user?.roles[0] as UserRole | undefined) ?? 'admin'
    // Novo usuário já nasce vinculado à liga ativa (pode ajustar antes de salvar).
    form.leagueIds = leagueContext.activeLeagueId ? [leagueContext.activeLeagueId] : []
  },
  { immediate: true },
)

async function handleSubmit() {
  const payload: UserPayload = {
    name: form.name,
    document: form.document.replace(/\D/g, ''),
    email: form.email || null,
  }
  if (form.password) payload.password = form.password
  if (props.canChangeRole) payload.role = form.role

  let result = await save(payload, props.user?.id)
  if (!result) return

  // Master acessa todas as ligas: vínculo só faz sentido para os demais papéis.
  if (!isEditing.value && form.role !== 'master' && form.leagueIds.length) {
    try {
      result = await usersService.attachLeagues(result.id, form.leagueIds)
    } catch {
      snackbar.error('Usuário criado, mas não foi possível vincular as ligas.')
      emit('saved', result)
      emit('update:modelValue', false)
      return
    }
  }

  snackbar.success(isEditing.value ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.')
  emit('saved', result)
  emit('update:modelValue', false)
}
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar usuário' : 'Novo usuário'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-text-field v-model="form.name" label="Nome" :error-messages="fieldErrors.name" data-test="user-name" />
    <v-row dense>
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="form.document"
          label="CPF"
          inputmode="numeric"
          maxlength="14"
          hint="Somente números"
          :error-messages="fieldErrors.document"
          data-test="user-document"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-text-field v-model="form.email" label="E-mail" type="email" :error-messages="fieldErrors.email" />
      </v-col>
    </v-row>
    <v-text-field
      v-model="form.password"
      label="Senha"
      :type="showPassword ? 'text' : 'password'"
      :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
      :hint="isEditing ? 'Deixe em branco para manter a senha atual' : 'Mínimo de 6 caracteres'"
      persistent-hint
      autocomplete="new-password"
      :error-messages="fieldErrors.password"
      data-test="user-password"
      @click:append-inner="showPassword = !showPassword"
    />
    <v-select
      v-if="canChangeRole"
      v-model="form.role"
      :items="USER_ROLE_OPTIONS"
      item-title="title"
      item-value="value"
      label="Papel"
      class="mt-2"
      :error-messages="fieldErrors.role"
      data-test="user-role"
    />
    <v-autocomplete
      v-if="!isEditing && form.role !== 'master'"
      v-model="form.leagueIds"
      :items="leagueItems"
      item-title="title"
      item-value="id"
      label="Ligas vinculadas"
      multiple
      chips
      closable-chips
      data-test="user-leagues"
    />
  </FormDialog>
</template>
