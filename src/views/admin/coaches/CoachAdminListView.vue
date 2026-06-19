<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { coachesService } from '@/services/api/coaches.service'
import { teamsService } from '@/services/api/teams.service'
import type { Coach, CoachPayload } from '@/types/coach'
import type { Team, TeamPayload } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Coach, CoachPayload>(
  coachesService,
)
const { items: teams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const coachToDelete = ref<Coach | null>(null)

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Time', key: 'team_id' },
  { title: 'Data de Nascimento', key: 'birth_date' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

function teamName(teamId: number | null): string {
  return teams.value.find((team) => team.id === teamId)?.name ?? '—'
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

function askDelete(coach: Coach) {
  coachToDelete.value = coach
  confirmDialog.value = true
}

async function handleDelete() {
  if (!coachToDelete.value) return
  const ok = await destroy(coachToDelete.value.id)
  if (ok) {
    snackbar.success('Técnico excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o técnico.')
  }
  coachToDelete.value = null
}

onMounted(() => {
  fetchAll()
  fetchAllTeams()
})
</script>

<template>
  <div>
    <PageHeader title="Técnicos">
      <template #action>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-coaches-create' }">
          Novo Técnico
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Buscar"
          single-line
          hide-details
          class="mb-4"
        />
        <v-data-table :headers="headers" :items="items" :search="search" :loading="loading" item-value="id">
          <template v-slot:[`item.team_id`]="{ item }">{{ teamName(item.team_id) }}</template>
          <template v-slot:[`item.birth_date`]="{ item }">{{ formatDate(item.birth_date) }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-coaches-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir técnico"
      :message="`Tem certeza que deseja excluir '${coachToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
