<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { playersService } from '@/services/api/players.service'
import { teamsService } from '@/services/api/teams.service'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import { optionTitle, type SelectOption } from '@/types/api'
import type { Player } from '@/types/player'
import type { Team, TeamLeague, TeamPayload } from '@/types/team'
import type { TechnicalCommitteeMember } from '@/types/technicalCommitteeMember'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import QueryTabs from '@/components/common/QueryTabs.vue'
import StatTiles from '@/components/common/StatTiles.vue'
import PlayerFormDialog from '@/components/players/PlayerFormDialog.vue'
import TeamFormDialog from '@/components/teams/TeamFormDialog.vue'
import TeamLeaguesDialog from '@/components/teams/TeamLeaguesDialog.vue'
import TeamStatsPanel from '@/components/teams/TeamStatsPanel.vue'
import TechnicalCommitteeMemberFormDialog from '@/components/technicalCommitteeMembers/TechnicalCommitteeMemberFormDialog.vue'

const props = defineProps<{ teamId: string }>()

const router = useRouter()
const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const { xs } = useDisplay()

const teamCrud = useCrud<Team, TeamPayload>(teamsService)

const leagueId = leagueContext.activeLeagueId as number
const team = ref<Team | null>(null)
const initializing = ref(true)
const positions = ref<SelectOption[]>([])
const roles = ref<SelectOption[]>([])

const can = {
  updateTeam: authStore.hasPermission('team:update'),
  deleteTeam: authStore.hasPermission('team:delete'),
  createPlayer: authStore.canManagePlayersOf('player:create', Number(props.teamId)),
  createMember: authStore.hasPermission('technical_committee_member:create'),
}

const players = computed(() =>
  [...(team.value?.players ?? [])].sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
)
const members = computed(() => team.value?.technicalCommitteeMembers ?? [])

const VIEW_COLUMN = {
  title: '',
  key: 'actions',
  sortable: false,
  align: 'end' as const,
  headerProps: { class: 'px-2' },
  cellProps: { class: 'px-2' },
}

const playerHeaders = computed(() => [
  { title: 'Nº', key: 'number', width: 56 },
  { title: 'Nome', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Posição', key: 'position' }]),
  VIEW_COLUMN,
])
const memberHeaders = computed(() => [
  { title: 'Nome', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Função', key: 'role' }]),
  VIEW_COLUMN,
])

const tabs = [
  { value: 'elenco', title: 'Elenco' },
  { value: 'comissao', title: 'Comissão Técnica' },
  { value: 'estatisticas', title: 'Estatísticas' },
]

const tiles = computed(() => [
  { label: 'Jogadores', value: players.value.length },
  { label: 'Comissão técnica', value: members.value.length },
])

const teamDialog = ref(false)
const leaguesDialog = ref(false)
const deleteTeamDialog = ref(false)
const playerDialog = ref(false)
const memberDialog = ref(false)

const deleteTeamMessage = computed(() => {
  if (!team.value) return ''
  const linked = [
    players.value.length ? `${players.value.length} jogador(es)` : null,
    members.value.length ? `${members.value.length} membro(s) da comissão` : null,
  ].filter(Boolean)
  return [
    `Excluir '${team.value.name}' remove o time de todas as ligas em que está vinculado.`,
    linked.length ? `${linked.join(' e ')} ficarão sem time.` : null,
    'Times com partidas cadastradas não podem ser excluídos.',
  ]
    .filter(Boolean)
    .join(' ')
})

async function loadTeam() {
  const data = await teamCrud.fetchOne(props.teamId)
  if (data) team.value = data
}

function onLeaguesUpdated(leagues: TeamLeague[]) {
  if (team.value) team.value.leagues = leagues
}

function playerRoute(player: Player) {
  return { name: 'admin-players-detail', params: { leagueId, teamId: props.teamId, id: player.id } }
}

function memberRoute(member: TechnicalCommitteeMember) {
  return {
    name: 'admin-technical-committee-members-detail',
    params: { leagueId, teamId: props.teamId, id: member.id },
  }
}

function onPlayerRow(_event: Event, row: { item: Player }) {
  router.push(playerRoute(row.item))
}

function onMemberRow(_event: Event, row: { item: TechnicalCommitteeMember }) {
  router.push(memberRoute(row.item))
}

async function handleDeleteTeam() {
  if (!team.value) return
  const ok = await teamCrud.destroy(team.value.id)
  if (ok) {
    snackbar.success('Time excluído com sucesso.')
    router.push({ name: 'admin-teams-list' })
  } else {
    snackbar.error(teamCrud.errorMessage.value ?? 'Não foi possível excluir o time.')
  }
}

onMounted(async () => {
  playersService.positions().then((data) => (positions.value = data)).catch(() => undefined)
  technicalCommitteeMembersService.roles().then((data) => (roles.value = data)).catch(() => undefined)
  try {
    await loadTeam()
  } finally {
    initializing.value = false
  }
})
</script>

<template>
  <div>
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-2"
      :to="{ name: 'admin-teams-list', params: { leagueId } }"
    >
      Times
    </v-btn>

    <div v-if="initializing" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="!team" type="error" variant="tonal">
      {{ teamCrud.errorMessage.value ?? 'Time não encontrado.' }}
    </v-alert>

    <template v-else>
      <v-card class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-4">
          <v-avatar size="64" rounded="lg" color="primary" variant="tonal">
            <v-img v-if="team.logo" :src="team.logo" cover data-test="team-logo" />
            <v-icon v-else icon="mdi-shield" size="32" />
          </v-avatar>
          <div class="header-title">
            <h1 class="text-h5 text-sm-h4 font-weight-bold text-break" data-test="team-title">{{ team.name }}</h1>
            <div class="text-medium-emphasis">{{ team.nickname ?? leagueContext.activeLeague?.name }}</div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-if="can.updateTeam"
              variant="tonal"
              prepend-icon="mdi-link-variant"
              data-test="team-leagues"
              @click="leaguesDialog = true"
            >
              Ligas
            </v-btn>
            <v-btn
              v-if="can.updateTeam"
              variant="tonal"
              prepend-icon="mdi-pencil"
              data-test="team-edit"
              @click="teamDialog = true"
            >
              Editar
            </v-btn>
            <v-btn
              v-if="can.deleteTeam"
              variant="tonal"
              color="error"
              prepend-icon="mdi-delete"
              data-test="team-delete"
              @click="deleteTeamDialog = true"
            >
              Excluir
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <StatTiles :items="tiles" class="mb-4" />

      <QueryTabs :tabs="tabs">
        <template #elenco>
          <v-card>
            <v-card-title class="d-flex align-center">
              <span class="text-subtitle-1 font-weight-bold">Elenco</span>
              <v-spacer />
              <v-btn
                v-if="can.createPlayer"
                color="primary"
                size="small"
                prepend-icon="mdi-plus"
                data-test="player-create"
                @click="playerDialog = true"
              >
                Jogador
              </v-btn>
            </v-card-title>
            <v-data-table
              :headers="playerHeaders"
              :items="players"
              item-value="id"
              :items-per-page="-1"
              hide-default-footer
              no-data-text="Nenhum jogador cadastrado neste time."
              hover
              data-test="players-table"
              @click:row="onPlayerRow"
            >
              <template v-slot:[`item.number`]="{ item }">{{ item.number ?? '—' }}</template>
              <template v-slot:[`item.name`]="{ item }">
                <div>{{ item.name }}</div>
                <div v-if="xs" class="text-caption text-medium-emphasis">
                  {{ optionTitle(positions, item.position) }}
                </div>
              </template>
              <template v-slot:[`item.position`]="{ item }">{{ optionTitle(positions, item.position) }}</template>
              <template v-slot:[`item.actions`]="{ item }">
                <v-btn
                  icon="mdi-eye-outline"
                  variant="text"
                  size="small"
                  :to="playerRoute(item)"
                  :aria-label="`Ver jogador ${item.name}`"
                  data-test="player-view"
                  @click.stop
                />
              </template>
            </v-data-table>
          </v-card>
        </template>

        <template #comissao>
          <v-card>
            <v-card-title class="d-flex align-center">
              <span class="text-subtitle-1 font-weight-bold">Comissão técnica</span>
              <v-spacer />
              <v-btn
                v-if="can.createMember"
                color="primary"
                size="small"
                prepend-icon="mdi-plus"
                data-test="member-create"
                @click="memberDialog = true"
              >
                Membro
              </v-btn>
            </v-card-title>
            <v-data-table
              :headers="memberHeaders"
              :items="members"
              item-value="id"
              :items-per-page="-1"
              hide-default-footer
              no-data-text="Nenhum membro da comissão técnica cadastrado."
              hover
              data-test="members-table"
              @click:row="onMemberRow"
            >
              <template v-slot:[`item.name`]="{ item }">
                <div>{{ item.name }}</div>
                <div v-if="xs" class="text-caption text-medium-emphasis">{{ optionTitle(roles, item.role) }}</div>
              </template>
              <template v-slot:[`item.role`]="{ item }">{{ optionTitle(roles, item.role) }}</template>
              <template v-slot:[`item.actions`]="{ item }">
                <v-btn
                  icon="mdi-eye-outline"
                  variant="text"
                  size="small"
                  :to="memberRoute(item)"
                  :aria-label="`Ver membro ${item.name}`"
                  data-test="member-view"
                  @click.stop
                />
              </template>
            </v-data-table>
          </v-card>
        </template>

        <template #estatisticas>
          <TeamStatsPanel :team-id="team.id" :league-id="leagueId" :players="players" />
        </template>
      </QueryTabs>

      <TeamFormDialog v-model="teamDialog" :league-id="leagueId" :team="team" @saved="loadTeam" />
      <TeamLeaguesDialog v-model="leaguesDialog" :team="team" @updated="onLeaguesUpdated" />
      <PlayerFormDialog v-if="can.createPlayer" v-model="playerDialog" :team-id="team.id" @saved="loadTeam" />
      <TechnicalCommitteeMemberFormDialog
        v-if="can.createMember"
        v-model="memberDialog"
        :team-id="team.id"
        @saved="loadTeam"
      />
      <ConfirmDialog
        v-model="deleteTeamDialog"
        title="Excluir time"
        :message="deleteTeamMessage"
        @confirm="handleDeleteTeam"
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
