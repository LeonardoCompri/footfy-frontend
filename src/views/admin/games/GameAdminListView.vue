<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import { championshipsService } from '@/services/api/championships.service'
import { teamsService } from '@/services/api/teams.service'
import { GAME_STATUS_OPTIONS } from '@/types/game'
import type { Game, GamePayload } from '@/types/game'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import type { Team, TeamPayload } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Game, GamePayload>(
  gamesService,
)
const { items: championships, fetchAll: fetchAllChampionships } = useCrud<
  Championship,
  ChampionshipPayload
>(championshipsService)
const { items: teams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const gameToDelete = ref<Game | null>(null)

const headers = [
  { title: 'Campeonato', key: 'championship_id' },
  { title: 'Rodada', key: 'round' },
  { title: 'Mandante x Visitante', key: 'matchup', sortable: false },
  { title: 'Placar', key: 'score', sortable: false },
  { title: 'Data', key: 'match_date' },
  { title: 'Status', key: 'status' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

function championshipName(id: number): string {
  return championships.value.find((c) => c.id === id)?.name ?? '—'
}

function teamName(id: number): string {
  return teams.value.find((t) => t.id === id)?.name ?? '—'
}

function statusLabel(status: Game['status']): string {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status)?.title ?? status
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('pt-BR')
}

function askDelete(game: Game) {
  gameToDelete.value = game
  confirmDialog.value = true
}

async function handleDelete() {
  if (!gameToDelete.value) return
  const ok = await destroy(gameToDelete.value.id)
  if (ok) {
    snackbar.success('Partida excluída com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir a partida.')
  }
  gameToDelete.value = null
}

onMounted(() => {
  fetchAll()
  fetchAllChampionships()
  fetchAllTeams()
})
</script>

<template>
  <div>
    <PageHeader title="Partidas">
      <template #action>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-games-create' }">
          Nova Partida
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
          <template v-slot:[`item.championship_id`]="{ item }">
            {{ championshipName(item.championship_id) }}
          </template>
          <template v-slot:[`item.round`]="{ item }">{{ item.round ?? '—' }}</template>
          <template v-slot:[`item.matchup`]="{ item }">
            {{ teamName(item.home_team_id) }} x {{ teamName(item.away_team_id) }}
          </template>
          <template v-slot:[`item.score`]="{ item }">
            {{ item.home_score ?? '—' }} x {{ item.away_score ?? '—' }}
          </template>
          <template v-slot:[`item.match_date`]="{ item }">{{ formatDate(item.match_date) }}</template>
          <template v-slot:[`item.status`]="{ item }">{{ statusLabel(item.status) }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-games-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir partida"
      :message="`Tem certeza que deseja excluir esta partida?`"
      @confirm="handleDelete"
    />
  </div>
</template>
