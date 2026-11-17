<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePublicItem } from '@/composables/usePublicItem'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import type { League } from '@/types/championship'
import QueryTabs from '@/components/common/QueryTabs.vue'
import StatTiles from '@/components/common/StatTiles.vue'
import TeamCard from '@/components/teams/TeamCard.vue'
import LeagueGamesPanel from '@/components/leagues/LeagueGamesPanel.vue'
import LeagueStatisticsPanel from '@/components/leagues/LeagueStatisticsPanel.vue'
import LeagueTablePanel from '@/components/leagues/LeagueTablePanel.vue'
import { bracketConfig } from '@/components/leagues/leagueKnockout'
import { groupQualifiers } from '@/components/leagues/standings'

const props = defineProps<{ id: string }>()

const { item: league, loading, errorMessage, fetchOne } = usePublicItem<League>(publicLeaguesService)
const tabs = [
  { value: 'times', title: 'Times' },
  { value: 'partidas', title: 'Partidas' },
  { value: 'estadios', title: 'Estádios' },
  { value: 'tabela', title: 'Tabela' },
  { value: 'estatisticas', title: 'Estatísticas' },
]

const teams = computed(() => league.value?.teams ?? [])
const stadiums = computed(() => league.value?.stadiums ?? [])

const statTiles = computed(() => [
  { label: 'Times', value: league.value?.teams_count ?? '—' },
  { label: 'Partidas', value: league.value?.games_count ?? '—' },
  { label: 'Estádios', value: league.value?.stadiums_count ?? '—' },
])

const backTo = computed(() =>
  league.value?.championship
    ? { name: 'championships-detail', params: { id: league.value.championship.id } }
    : { name: 'championships-list' },
)

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

      <StatTiles :items="statTiles" class="mb-6" data-test="league-counts" />

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
          <LeagueGamesPanel :load="(params) => publicLeaguesService.games(props.id, params)" />
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
          <LeagueTablePanel
            :format="league.format"
            :qualifiers="groupQualifiers(league)"
            :bracket="bracketConfig(league)"
            :load="() => publicLeaguesService.table(props.id)"
          />
        </template>

        <template #estatisticas>
          <LeagueStatisticsPanel :load="() => publicLeaguesService.statistics(props.id)" />
        </template>
      </QueryTabs>
    </template>
  </v-container>
</template>
