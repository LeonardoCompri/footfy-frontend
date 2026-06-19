<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { usersService } from '@/services/api/users.service'
import { championshipsService } from '@/services/api/championships.service'
import { USER_ROLE_OPTIONS } from '@/types/user'
import type { User, UserPayload } from '@/types/user'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import PageHeader from '@/components/common/PageHeader.vue'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<User, UserPayload>(
  usersService,
)
const { items: championships, fetchAll: fetchAllChampionships } = useCrud<
  Championship,
  ChampionshipPayload
>(championshipsService)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Usuário' : 'Novo Usuário'))
const initializing = ref(isEditing.value)

const form = reactive({
  name: '',
  email: null as string | null,
  document: '',
  password: '',
  role: 'admin' as UserPayload['role'],
})

const originalChampionshipIds = ref<number[]>([])
const selectedChampionshipIds = ref<number[]>([])

onMounted(async () => {
  fetchAllChampionships()
  if (!props.id) return
  try {
    const user = await fetchOne(props.id)
    if (user) {
      form.name = user.name
      form.email = user.email
      form.document = user.document
      form.role = (user.roles[0] as UserPayload['role']) ?? 'admin'
      selectedChampionshipIds.value = user.championships.map((c) => c.id)
      originalChampionshipIds.value = [...selectedChampionshipIds.value]
    }
  } finally {
    initializing.value = false
  }
})

async function syncChampionshipChanges(userId: number) {
  const toRemove = originalChampionshipIds.value.filter(
    (id) => !selectedChampionshipIds.value.includes(id),
  )
  if (selectedChampionshipIds.value.length > 0) {
    await usersService.syncChampionships(userId, selectedChampionshipIds.value)
  }
  for (const championshipId of toRemove) {
    await usersService.removeChampionship(userId, championshipId)
  }
}

async function handleSubmit() {
  const payload: UserPayload = {
    name: form.name,
    email: form.email,
    document: form.document,
    role: form.role,
  }
  if (form.password) {
    payload.password = form.password
  }
  const result = await save(payload, props.id)
  if (result) {
    if (isEditing.value) {
      await syncChampionshipChanges(result.id)
    }
    snackbar.success(isEditing.value ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.')
    router.push({ name: 'admin-users-list' })
  }
}
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text v-if="initializing" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
      <v-card-text v-else>
        <v-form @submit.prevent="handleSubmit">
          <v-text-field
            v-model="form.name"
            label="Nome"
            :error-messages="fieldErrors.name"
            class="mb-2"
          />
          <v-text-field
            v-model="form.document"
            label="CPF"
            maxlength="11"
            :error-messages="fieldErrors.document"
            class="mb-2"
          />
          <v-text-field
            v-model="form.email"
            label="Email"
            :error-messages="fieldErrors.email"
            class="mb-2"
          />
          <v-text-field
            v-model="form.password"
            label="Senha"
            type="password"
            :placeholder="isEditing ? 'Deixe em branco para manter a senha atual' : undefined"
            :error-messages="fieldErrors.password"
            class="mb-2"
          />
          <v-select
            v-model="form.role"
            :items="USER_ROLE_OPTIONS"
            item-title="title"
            item-value="value"
            label="Papel"
            :error-messages="fieldErrors.role"
            class="mb-2"
          />
          <v-autocomplete
            v-if="isEditing"
            v-model="selectedChampionshipIds"
            :items="championships"
            item-title="name"
            item-value="id"
            label="Campeonatos vinculados"
            multiple
            chips
            closable-chips
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-users-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading">Salvar</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
