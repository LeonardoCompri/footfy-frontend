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
import type { Player, PlayerPayload } from '@/types/player'
import type { Team, TeamLeague, TeamPayload } from '@/types/team'
import type {
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload,
} from '@/types/technicalCommitteeMember'
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
const playerCrud = useCrud<Player, PlayerPayload>(playersService)
const memberCrud = useCrud<TechnicalCommitteeMember, TechnicalCommitteeMemberPayload>(
  technicalCommitteeMembersService,
)

const leagueId = leagueContext.activeLeagueId as number
const team = ref<Team | null>(null)
const initializing = ref(true)
const positions = ref<SelectOption[]>([])
const roles = ref<SelectOption[]>([])

const can = {
  updateTeam: authStore.hasPermission('team:update'),
  deleteTeam: authStore.hasPermission('team:delete'),
  createPlayer: authStore.hasPermission('player:create'),
  updatePlayer: authStore.hasPermission('player:update'),
  deletePlayer: authStore.hasPermission('player:delete'),
  createMember: authStore.hasPermission('technical_committee_member:create'),
  updateMember: authStore.hasPermission('technical_committee_member:update'),
  deleteMember: authStore.hasPermission('technical_committee_member:delete'),
}

const players = computed(() =>
  [...(team.value?.players ?? [])].sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
)
const members = computed(() => team.value?.technicalCommitteeMembers ?? [])

// No mobile a coluna Posição/Função vira legenda sob o nome, para a tabela caber sem scroll.
const playerHeaders = computed(() => [
  { title: 'Nº', key: 'number', width: 56 },
  { title: 'Nome', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Posição', key: 'position' }]),
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
])
const memberHeaders = computed(() => [
  { title: 'Nome', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Função', key: 'role' }]),
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
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

// Dialogs
const teamDialog = ref(false)
const leaguesDialog = ref(false)
const deleteTeamDialog = ref(false)
const playerDialog = ref(false)
const playerToEdit = ref<Player | null>(null)
const memberDialog = ref(false)
const memberToEdit = ref<TechnicalCommitteeMember | null>(null)
const confirmDialog = ref(false)
const pendingDelete = ref<{ kind: 'player' | 'member'; id: number; name: string } | null>(null)

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

// Recarrega após criar/editar/excluir; uma falha no reload não apaga o time já exibido.
async function loadTeam() {
  const data = await teamCrud.fetchOne(props.teamId)
  if (data) team.value = data
}

function onLeaguesUpdated(leagues: TeamLeague[]) {
  if (team.value) team.value.leagues = leagues
}

function openPlayer(player: Player) {
  router.push({ name: 'admin-players-detail', params: { teamId: props.teamId, id: player.id } })
}

function openMember(member: TechnicalCommitteeMember) {
  router.push({
    name: 'admin-technical-committee-members-detail',
    params: { teamId: props.teamId, id: member.id },
  })
}

function onPlayerRow(_event: Event, row: { item: Player }) {
  openPlayer(row.item)
}

function onMemberRow(_event: Event, row: { item: TechnicalCommitteeMember }) {
  openMember(row.item)
}

function editPlayer(player: Player | null) {
  playerToEdit.value = player
  playerDialog.value = true
}

function editMember(member: TechnicalCommitteeMember | null) {
  memberToEdit.value = member
  memberDialog.value = true
}

function askDelete(kind: 'player' | 'member', item: { id: number; name: string }) {
  pendingDelete.value = { kind, id: item.id, name: item.name }
  confirmDialog.value = true
}

async function handleDelete() {
  const target = pendingDelete.value
  if (!target) return
  const crud = target.kind === 'player' ? playerCrud : memberCrud
  const ok = await crud.destroy(target.id)
  if (ok) {
    snackbar.success(
      target.kind === 'player' ? 'Jogador removido do elenco.' : 'Membro excluído com sucesso.',
    )
    await loadTeam()
  } else {
    snackbar.error(crud.errorMessage.value ?? 'Não foi possível excluir.')
  }
  pendingDelete.value = null
}

async function handleDeleteTeam() {
  if (!team.value) return
  const ok = await teamCrud.destroy(team.value.id)
  if (ok) {
    snackbar.success('Time excluído com sucesso.')
    router.push({ name: 'admin-teams-list' })
  } else {
    // Ex.: 422 do backend quando o time tem partidas vinculadas.
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
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2" :to="{ name: 'admin-teams-list' }">
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
                @click="editPlayer(null)"
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
                <div class="d-flex justify-end">
                  <v-btn
                    v-if="can.updatePlayer"
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    data-test="player-edit"
                    @click.stop="editPlayer(item)"
                  />
                  <v-btn
                    v-if="can.deletePlayer"
                    icon="mdi-delete"
                    variant="text"
                    size="small"
                    color="error"
                    data-test="player-delete"
                    @click.stop="askDelete('player', item)"
                  />
                </div>
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
                @click="editMember(null)"
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
                <div class="d-flex justify-end">
                  <v-btn
                    v-if="can.updateMember"
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    data-test="member-edit"
                    @click.stop="editMember(item)"
                  />
                  <v-btn
                    v-if="can.deleteMember"
                    icon="mdi-delete"
                    variant="text"
                    size="small"
                    color="error"
                    data-test="member-delete"
                    @click.stop="askDelete('member', item)"
                  />
                </div>
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
      <PlayerFormDialog v-model="playerDialog" :team-id="team.id" :player="playerToEdit" @saved="loadTeam" />
      <TechnicalCommitteeMemberFormDialog
        v-model="memberDialog"
        :team-id="team.id"
        :member="memberToEdit"
        @saved="loadTeam"
      />
      <ConfirmDialog
        v-model="deleteTeamDialog"
        title="Excluir time"
        :message="deleteTeamMessage"
        @confirm="handleDeleteTeam"
      />
      <ConfirmDialog
        v-model="confirmDialog"
        :title="pendingDelete?.kind === 'player' ? 'Remover do elenco' : 'Excluir membro'"
        :message="
          pendingDelete?.kind === 'player'
            ? `Remover '${pendingDelete.name}' do elenco (as estatísticas são mantidas).`
            : `Tem certeza que deseja excluir '${pendingDelete?.name}'?`
        "
        :confirm-text="pendingDelete?.kind === 'player' ? 'Remover' : 'Excluir'"
        @confirm="handleDelete"
      />
    </template>
  </div>
</template>

<style scoped>
/* Nome ao lado do avatar mesmo no mobile; as ações quebram para a linha de baixo. */
.header-title {
  flex: 1 1 0;
  min-width: 160px;
}
</style>
