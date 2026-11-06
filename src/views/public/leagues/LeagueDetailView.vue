<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePublicItem } from '@/composables/usePublicItem'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import { GAME_STATUS_OPTIONS } from '@/types/game'
import type { Game } from '@/types/game'
import type { League } from '@/types/championship'
import QueryTabs from '@/components/common/QueryTabs.vue'
import StatTiles from '@/components/common/StatTiles.vue'
import TeamCard from '@/components/teams/TeamCard.vue'
import LeagueStatisticsPanel from '@/components/leagues/LeagueStatisticsPanel.vue'
import LeagueTablePanel from '@/components/leagues/LeagueTablePanel.vue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const { item: league, loading, errorMessage, fetchOne } = usePublicItem<League>(publicLeaguesService)
const tabs = [
  { value: 'times', title: 'Times' },
  { value: 'partidas', title: 'Partidas' },
  { value: 'estadios', title: 'Estádios' },
  { value: 'tabela', title: 'Tabela' },
  { value: 'estatisticas', title: 'Estatísticas' },
]

const teams = computed(() => league.value?.teams ?? [])
const games = computed(() =>
  [...(league.value?.games ?? [])].sort((a, b) => (a.round ?? 0) - (b.round ?? 0)),
)
const stadiums = computed(() => league.value?.stadiums ?? [])

const statTiles = computed(() => [
  { label: 'Times', value: teams.value.length },
  { label: 'Partidas', value: games.value.length },
  { label: 'Estádios', value: stadiums.value.length },
])

const backTo = computed(() =>
  league.value?.championship
    ? { name: 'championships-detail', params: { id: league.value.championship.id } }
    : { name: 'championships-list' },
)

function teamName(id: number): string {
  return teams.value.find((team) => team.id === id)?.name ?? '—'
}

function statusLabel(status: Game['status']): string {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status)?.title ?? status
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

function goToGame(id: number) {
  router.push({ name: 'games-detail', params: { id } })
}

onMounted(() => fetchOne(props.id))
</script>

<template>
  <v-container class="py-8">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-4"
      :to="backTo"
    >
      Voltar
    </v-btn>

    <v-row v-if="loading" justify="center">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>

    <template v-else-if="league">
      <div class="mb-6">
        <h1 class="text-h4 font-weight-bold">{{ league.name }}</h1>
        <p v-if="league.championship" class="text-medium-emphasis mt-1">
          {{ league.championship.name }}
        </p>
      </div>

      <StatTiles :items="statTiles" class="mb-6" />

      <QueryTabs :tabs="tabs">
        <template #times>
          <v-alert v-if="teams.length === 0" type="info" variant="tonal">
            Nenhum time cadastrado para esta liga ainda.
          </v-alert>
          <v-row v-else>
            <v-col v-for="team in teams" :key="team.id" cols="12" sm="6" md="4">
              <TeamCard :team="team" :league-id="league.id" />
            </v-col>
          </v-row>
        </template>

        <template #partidas>
          <v-alert v-if="games.length === 0" type="info" variant="tonal">
            Nenhuma partida cadastrada para esta liga ainda.
          </v-alert>
          <v-table v-else>
            <thead>
              <tr>
                <th>Rodada</th>
                <th>Mandante</th>
                <th>Placar</th>
                <th>Visitante</th>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in games" :key="game.id" class="cursor-pointer" @click="goToGame(game.id)">
                <td>{{ game.round ?? '—' }}</td>
                <td>{{ teamName(game.home_team_id) }}</td>
                <td>{{ game.home_score ?? '—' }} x {{ game.away_score ?? '—' }}</td>
                <td>{{ teamName(game.away_team_id) }}</td>
                <td>{{ formatDate(game.match_date) }}</td>
                <td>{{ statusLabel(game.status) }}</td>
              </tr>
            </tbody>
          </v-table>
        </template>

        <template #estadios>
          <v-alert v-if="stadiums.length === 0" type="info" variant="tonal">
            Nenhum estádio cadastrado para esta liga ainda.
          </v-alert>
          <v-row v-else>
            <v-col v-for="stadium in stadiums" :key="stadium.id" cols="12" sm="6" md="4">
              <v-card>
                <v-card-item>
                  <v-card-title>{{ stadium.name }}</v-card-title>
                  <v-card-subtitle>{{ stadium.city }}</v-card-subtitle>
                </v-card-item>
                <v-card-text>Capacidade: {{ stadium.capacity }}</v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </template>

        <template #tabela>
          <LeagueTablePanel :format="league.format" :load="() => publicLeaguesService.table(props.id)" />
        </template>

        <template #estatisticas>
          <LeagueStatisticsPanel :load="() => publicLeaguesService.statistics(props.id)" />
        </template>
      </QueryTabs>
    </template>
  </v-container>
</template>
