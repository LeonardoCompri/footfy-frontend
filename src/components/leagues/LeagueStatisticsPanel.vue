<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import type { LeagueStatistics } from '@/types/leagueStats'
import StatTiles from '@/components/common/StatTiles.vue'
import CardsBarChart from '@/components/charts/CardsBarChart.vue'
import GoalsBarChart from '@/components/charts/GoalsBarChart.vue'
import ResultsSplitBar from '@/components/charts/ResultsSplitBar.vue'
import { useChartPalette } from '@/components/charts/chartPalette'
import RankingTable from './RankingTable.vue'
import type { RankingColumn } from './RankingTable.vue'

const props = defineProps<{
  load: () => Promise<LeagueStatistics>
}>()

const stats = ref<LeagueStatistics | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)

const tiles = computed(() => {
  if (!stats.value) return []
  const { goals, finished_games, goals_average } = stats.value.totals
  const cards = stats.value.cards_split
  return [
    { label: 'Gols', value: goals },
    { label: 'Partidas finalizadas', value: finished_games },
    {
      label: 'Média de gols',
      value:
        goals_average == null
          ? '—'
          : goals_average.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
    },
    ...(cards
      ? [
          { label: 'Cartões amarelos', value: cards.yellow },
          { label: 'Cartões vermelhos', value: cards.red },
        ]
      : []),
  ]
})

const scorerColumns: RankingColumn[] = [{ key: 'goals', title: 'Gols' }]
const assistColumns: RankingColumn[] = [{ key: 'assists', title: 'Assist.' }]
const palette = useChartPalette()
const cardColumns = computed<RankingColumn[]>(() => [
  { key: 'yellow_cards', title: 'Cartões amarelos', icon: 'mdi-card', iconColor: palette.value.yellowCard, width: 36 },
  { key: 'red_cards', title: 'Cartões vermelhos', icon: 'mdi-card', iconColor: palette.value.redCard, width: 36 },
  { key: 'total_cards', title: 'Total', width: 64 },
])

onMounted(async () => {
  try {
    stats.value = await props.load()
  } catch (err) {
    errorMessage.value = extractErrorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>
    <template v-else-if="stats">
      <StatTiles :items="tiles" class="mb-2" data-test="league-stat-tiles" />

      <v-row>
        <v-col cols="12" md="4">
          <RankingTable
            title="Artilharia"
            icon="mdi-soccer"
            :rows="stats.top_scorers"
            :columns="scorerColumns"
            empty-text="Nenhum gol registrado ainda."
            data-test="top-scorers"
          />
        </v-col>
        <v-col cols="12" md="4">
          <RankingTable
            title="Assistências"
            icon="mdi-shoe-sneaker"
            :rows="stats.top_assists"
            :columns="assistColumns"
            empty-text="Nenhuma assistência registrada ainda."
            data-test="top-assists"
          />
        </v-col>
        <v-col cols="12" md="4">
          <RankingTable
            title="Cartões"
            icon="mdi-card"
            :rows="stats.top_cards"
            :columns="cardColumns"
            empty-text="Nenhum cartão registrado ainda."
            data-test="top-cards"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="7">
          <v-card class="h-100">
            <v-card-title class="text-subtitle-1 font-weight-bold">Gols por rodada/fase</v-card-title>
            <v-card-text>
              <GoalsBarChart :buckets="stats.goals_by_bucket" />
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card :class="{ 'mb-4': stats.cards_split }">
            <v-card-title class="text-subtitle-1 font-weight-bold">Resultados</v-card-title>
            <v-card-text>
              <ResultsSplitBar :split="stats.results_split" />
            </v-card-text>
          </v-card>
          <v-card v-if="stats.cards_split">
            <v-card-title class="text-subtitle-1 font-weight-bold">Cartões</v-card-title>
            <v-card-text>
              <CardsBarChart :cards="stats.cards_split" />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
