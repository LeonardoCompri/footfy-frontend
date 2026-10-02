<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { useSnackbar } from '@/composables/useSnackbar'
import { teamsService } from '@/services/api/teams.service'
import type { Team, TeamPayload } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Team, TeamPayload>(
  teamsService,
)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const teamToDelete = ref<Team | null>(null)

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Apelido', key: 'nickname' },
  { title: 'Logo', key: 'logo' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

function askDelete(team: Team) {
  teamToDelete.value = team
  confirmDialog.value = true
}

async function handleDelete() {
  if (!teamToDelete.value) return
  const ok = await destroy(teamToDelete.value.id)
  if (ok) {
    snackbar.success('Time excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o time.')
  }
  teamToDelete.value = null
}

// Lista escopada pela Liga ativa (o layout remonta a tela ao trocar de liga).
const leagueContext = useLeagueContextStore()

onMounted(() => fetchAll({ league_id: leagueContext.activeLeagueId ?? undefined }))
</script>

<template>
  <div>
    <PageHeader title="Times">
      <template #action>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-teams-create' }">
          Novo Time
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
          <template v-slot:[`item.nickname`]="{ item }">{{ item.nickname ?? '—' }}</template>
          <template v-slot:[`item.logo`]="{ item }">{{ item.logo ?? '—' }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-teams-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir time"
      :message="`Tem certeza que deseja excluir '${teamToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
