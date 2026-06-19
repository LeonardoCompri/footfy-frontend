<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { coachesService } from '@/services/api/coaches.service'
import { teamsService } from '@/services/api/teams.service'
import type { Coach, CoachPayload } from '@/types/coach'
import type { Team, TeamPayload } from '@/types/team'
import PageHeader from '@/components/common/PageHeader.vue'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<Coach, CoachPayload>(
  coachesService,
)
const { items: teams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Técnico' : 'Novo Técnico'))
const initializing = ref(isEditing.value)

const form = reactive<CoachPayload>({
  team_id: null,
  name: '',
  birth_date: null,
})

onMounted(async () => {
  fetchAllTeams()
  if (!props.id) return
  try {
    const coach = await fetchOne(props.id)
    if (coach) {
      form.team_id = coach.team_id
      form.name = coach.name
      form.birth_date = coach.birth_date
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit() {
  const result = await save(form, props.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Técnico atualizado com sucesso.' : 'Técnico criado com sucesso.')
    router.push({ name: 'admin-coaches-list' })
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
          <v-autocomplete
            v-model="form.team_id"
            :items="teams"
            item-title="name"
            item-value="id"
            label="Time"
            clearable
            :error-messages="fieldErrors.team_id"
            class="mb-2"
          />
          <v-text-field
            v-model="form.birth_date"
            label="Data de nascimento"
            type="date"
            :error-messages="fieldErrors.birth_date"
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-coaches-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading">Salvar</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
