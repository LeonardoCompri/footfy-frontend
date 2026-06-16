<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { playersService } from '@/services/api/players.service'
import { teamsService } from '@/services/api/teams.service'
import type { Player, PlayerPayload } from '@/types/player'
import type { Team, TeamPayload } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Player, PlayerPayload>(
  playersService,
)
const { items: teams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const playerToDelete = ref<Player | null>(null)

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Time', key: 'team_id' },
  { title: 'Posição', key: 'position' },
  { title: 'Número', key: 'number' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

const teamNameById = computed(() => {
  const map = new Map<number, string>()
  teams.value.forEach((team) => map.set(team.id, team.name))
  return map
})

function teamName(teamId: number | null): string {
  if (teamId === null) return '—'
  return teamNameById.value.get(teamId) ?? `#${teamId}`
}

function askDelete(player: Player) {
  playerToDelete.value = player
  confirmDialog.value = true
}

async function handleDelete() {
  if (!playerToDelete.value) return
  const ok = await destroy(playerToDelete.value.id)
  if (ok) {
    snackbar.success('Jogador excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o jogador.')
  }
  playerToDelete.value = null
}

onMounted(() => {
  fetchAll()
  fetchAllTeams()
})
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4 font-weight-bold">Jogadores</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-players-create' }">
        Novo Jogador
      </v-btn>
    </div>

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
          <template v-slot:[`item.position`]="{ item }">{{ item.position ?? '—' }}</template>
          <template v-slot:[`item.number`]="{ item }">{{ item.number ?? '—' }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-players-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir jogador"
      :message="`Tem certeza que deseja excluir '${playerToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
