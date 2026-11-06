<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { playersService } from '@/services/api/players.service'
import { teamsService } from '@/services/api/teams.service'
import { optionTitle, type SelectOption } from '@/types/api'
import type { Player, PlayerPayload } from '@/types/player'
import type { Team } from '@/types/team'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import QueryTabs from '@/components/common/QueryTabs.vue'
import PlayerFormDialog from '@/components/players/PlayerFormDialog.vue'
import PlayerStatsPanel from '@/components/players/PlayerStatsPanel.vue'
import { formatBirthDate, formatCpf } from '@/components/common/format'

const props = defineProps<{ teamId: string; id: string }>()

const router = useRouter()
const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const tabs = [
  { value: 'perfil', title: 'Perfil' },
  { value: 'estatisticas', title: 'Estatísticas' },
]
const { errorMessage, fetchOne, destroy } = useCrud<Player, PlayerPayload>(playersService)

const leagueId = leagueContext.activeLeagueId as number
const player = ref<Player | null>(null)
const team = ref<Team | null>(null)
const positions = ref<SelectOption[]>([])
const initializing = ref(true)
const editDialog = ref(false)
const deleteDialog = ref(false)

const canUpdate = computed(
  () => !!player.value && authStore.canManagePlayersOf('player:update', player.value.team_id),
)
const canDelete = computed(
  () => !!player.value && authStore.canManagePlayersOf('player:delete', player.value.team_id),
)

const teamRoute = computed(() => ({
  name: 'admin-teams-detail',
  params: { leagueId, teamId: props.teamId },
}))

const profile = computed(() => {
  if (!player.value) return []
  return [
    { label: 'Time', value: team.value?.name ?? '—', icon: 'mdi-shield' },
    { label: 'Posição', value: optionTitle(positions.value, player.value.position), icon: 'mdi-soccer' },
    { label: 'Número', value: player.value.number ?? '—', icon: 'mdi-pound' },
    { label: 'Nascimento', value: formatBirthDate(player.value.birth_date), icon: 'mdi-cake-variant' },
    { label: 'CPF', value: formatCpf(player.value.document) || '—', icon: 'mdi-card-account-details' },
  ]
})

async function handleDelete() {
  if (!player.value) return
  if (await destroy(player.value.id)) {
    snackbar.success('Jogador removido do elenco.')
    router.push(teamRoute.value)
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível remover o jogador.')
  }
}

onMounted(async () => {
  playersService.positions().then((data) => (positions.value = data)).catch(() => undefined)
  try {
    const [loadedPlayer, loadedTeam] = await Promise.all([
      fetchOne(props.id),
      teamsService.get(props.teamId).catch(() => null),
    ])
    player.value = loadedPlayer
    team.value = loadedTeam
  } finally {
    initializing.value = false
  }
})
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2" :to="teamRoute" data-test="back-to-team">
      {{ team?.name ?? 'Time' }}
    </v-btn>

    <div v-if="initializing" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="!player" type="error" variant="tonal">
      {{ errorMessage ?? 'Jogador não encontrado.' }}
    </v-alert>

    <template v-else>
      <v-card class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-4">
          <v-avatar size="64" color="primary" variant="tonal">
            <span class="text-h6 font-weight-bold">{{ player.number ?? '—' }}</span>
          </v-avatar>
          <div class="header-title">
            <h1 class="text-h5 text-sm-h4 font-weight-bold text-break" data-test="player-title">
              {{ player.name }}
            </h1>
            <div class="text-medium-emphasis">{{ optionTitle(positions, player.position) }}</div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-if="canUpdate"
              variant="tonal"
              prepend-icon="mdi-pencil"
              data-test="player-edit"
              @click="editDialog = true"
            >
              Editar
            </v-btn>
            <v-btn
              v-if="canDelete"
              variant="tonal"
              color="error"
              prepend-icon="mdi-delete"
              data-test="player-delete"
              @click="deleteDialog = true"
            >
              Remover
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <QueryTabs :tabs="tabs">
        <template #perfil>
          <v-card>
            <v-list lines="two" data-test="player-profile">
              <v-list-item
                v-for="field in profile"
                :key="field.label"
                :prepend-icon="field.icon"
                :title="String(field.value)"
                :subtitle="field.label"
              />
            </v-list>
          </v-card>
        </template>
        <template #estatisticas>
          <PlayerStatsPanel :player-id="player.id" :league-id="leagueId" />
        </template>
      </QueryTabs>

      <PlayerFormDialog
        v-model="editDialog"
        :team-id="Number(teamId)"
        :player="player"
        @saved="player = $event"
      />
      <ConfirmDialog
        v-model="deleteDialog"
        title="Remover do elenco"
        :message="`Remover '${player.name}' do elenco (as estatísticas são mantidas).`"
        confirm-text="Remover"
        @confirm="handleDelete"
      />
    </template>
  </div>
</template>

<style scoped>
.header-title {
  flex: 1 1 0;
  min-width: 160px;
}
</style>
