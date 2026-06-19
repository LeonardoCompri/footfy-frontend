<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { teamsService } from '@/services/api/teams.service'
import type { Team, TeamPayload } from '@/types/team'
import PageHeader from '@/components/common/PageHeader.vue'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<Team, TeamPayload>(
  teamsService,
)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Time' : 'Novo Time'))
const initializing = ref(isEditing.value)

const form = reactive<TeamPayload>({
  name: '',
  nickname: null,
  logo: null,
})

onMounted(async () => {
  if (!props.id) return
  try {
    const team = await fetchOne(props.id)
    if (team) {
      form.name = team.name
      form.nickname = team.nickname
      form.logo = team.logo
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit() {
  const result = await save(form, props.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Time atualizado com sucesso.' : 'Time criado com sucesso.')
    router.push({ name: 'admin-teams-list' })
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
            v-model="form.nickname"
            label="Apelido"
            :error-messages="fieldErrors.nickname"
            class="mb-2"
          />
          <v-text-field
            v-model="form.logo"
            label="URL do Logo"
            :error-messages="fieldErrors.logo"
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-teams-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading">Salvar</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
