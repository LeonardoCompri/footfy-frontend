<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePublicItem } from '@/composables/usePublicItem'
import { useQueryTab } from '@/composables/useQueryTab'
import { publicTeamsService } from '@/services/api/publicTeams.service'
import type { Team } from '@/types/team'
import StatTiles from '@/components/common/StatTiles.vue'

const props = defineProps<{ id: string }>()
const route = useRoute()

const { item: team, loading, errorMessage, fetchOne } = usePublicItem<Team>(publicTeamsService)
const { tab } = useQueryTab('elenco')

const roster = computed(() => team.value?.players ?? [])

// TODO(FOOT-0024): GET /public/teams/{id} ainda não retorna a comissão técnica do time.
// Depende de TeamService::publicShow() passar a incluir `technicalCommitteeMembers`
// no eager load da rota pública. Até lá, exibimos vazio.
const technicalCommittee: { id: number; name: string; role: string; birth_date: string | null }[] = []

const backLeagueId = computed(() =>
  typeof route.query.back === 'string' ? route.query.back : null,
)
const backTo = computed(() =>
  backLeagueId.value
    ? { name: 'leagues-detail', params: { id: backLeagueId.value } }
    : { name: 'teams-list' },
)

const statTiles = computed(() => [
  { label: 'Elenco', value: roster.value.length },
  { label: 'Comissão Técnica', value: technicalCommittee.length },
])

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

onMounted(() => fetchOne(props.id))
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" :to="backTo"> Voltar </v-btn>

    <v-row v-if="loading" justify="center">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>

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

      <StatTiles :items="statTiles" class="mb-6" />

      <v-tabs v-model="tab" color="primary" class="mb-4">
        <v-tab value="elenco">Elenco</v-tab>
        <v-tab value="comissao">Comissão Técnica</v-tab>
        <v-tab value="estatisticas">Estatísticas</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="elenco">
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
        </v-window-item>

        <v-window-item value="comissao">
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
        </v-window-item>

        <!-- TODO(FOOT-0027): depende da rota pública de estatísticas do time. -->
        <v-window-item value="estatisticas">
          <v-alert type="info" variant="tonal">Estatísticas em breve.</v-alert>
        </v-window-item>
      </v-window>
    </template>
  </v-container>
</template>
