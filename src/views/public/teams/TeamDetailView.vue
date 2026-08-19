<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { teamsService } from '@/services/api/teams.service'
import { playersService } from '@/services/api/players.service'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import type { Team, TeamPayload } from '@/types/team'
import type { Player, PlayerPayload } from '@/types/player'
import type {
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload,
} from '@/types/technicalCommitteeMember'

const props = defineProps<{ id: string }>()

const {
  fetchOne,
  loading: teamLoading,
  errorMessage: teamError,
} = useCrud<Team, TeamPayload>(teamsService)
const {
  items: allPlayers,
  fetchAll: fetchAllPlayers,
  loading: playersLoading,
} = useCrud<Player, PlayerPayload>(playersService)
const {
  items: allMembers,
  fetchAll: fetchAllMembers,
  loading: membersLoading,
} = useCrud<TechnicalCommitteeMember, TechnicalCommitteeMemberPayload>(
  technicalCommitteeMembersService,
)

const team = ref<Team | null>(null)

const loading = computed(
  () => teamLoading.value || playersLoading.value || membersLoading.value,
)

const roster = computed(() => allPlayers.value.filter((p) => p.team_id === Number(props.id)))
const technicalCommittee = computed(() =>
  allMembers.value.filter((member) => member.team_id === Number(props.id)),
)

function formatNumber(number: number | null): string {
  return number !== null ? String(number) : '—'
}

function formatPosition(position: string | null): string {
  return position ?? '—'
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

onMounted(async () => {
  team.value = await fetchOne(props.id)
  await Promise.all([fetchAllPlayers(), fetchAllMembers()])
})
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" :to="{ name: 'teams-list' }">
      Voltar
    </v-btn>

    <v-row v-if="loading" justify="center">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="teamError" type="error" variant="tonal">{{ teamError }}</v-alert>

    <template v-else-if="team">
      <v-card class="mb-6">
        <v-card-item>
          <v-card-title class="text-h4">{{ team.name }}</v-card-title>
          <v-card-subtitle v-if="team.nickname">{{ team.nickname }}</v-card-subtitle>
        </v-card-item>
        <v-card-text v-if="team.logo">
          <v-img :src="team.logo" height="160" contain />
        </v-card-text>
      </v-card>

      <h2 class="text-h5 font-weight-bold mb-4">Elenco</h2>

      <v-alert v-if="roster.length === 0" type="info" variant="tonal">
        Nenhum jogador cadastrado para este time ainda.
      </v-alert>

      <v-table v-else>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Posição</th>
            <th>Número</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in roster" :key="player.id">
            <td>{{ player.name }}</td>
            <td>{{ formatPosition(player.position) }}</td>
            <td>{{ formatNumber(player.number) }}</td>
          </tr>
        </tbody>
      </v-table>

      <h2 class="text-h5 font-weight-bold mb-4 mt-8">Comissão Técnica</h2>

      <v-alert v-if="technicalCommittee.length === 0" type="info" variant="tonal">
        Nenhum membro da comissão técnica cadastrado para este time ainda.
      </v-alert>

      <v-table v-else>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Função</th>
            <th>Data de Nascimento</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in technicalCommittee" :key="member.id">
            <td>{{ member.name }}</td>
            <td>{{ member.role }}</td>
            <td>{{ formatDate(member.birth_date) }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>
  </v-container>
</template>
