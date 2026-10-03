<script setup lang="ts">
import type { RankingPlayer } from '@/types/leagueStats'

// Ranking de jogadores da liga (artilharia, assistências, cartões): colunas numéricas por `columns`.
defineProps<{
  title: string
  icon: string
  rows: (RankingPlayer & Record<string, unknown>)[]
  columns: { key: string; title: string }[]
  emptyText: string
}>()
</script>

<template>
  <v-card class="h-100">
    <v-card-title class="d-flex align-center ga-2 text-subtitle-1 font-weight-bold">
      <v-icon :icon="icon" size="20" color="primary" />
      {{ title }}
    </v-card-title>
    <v-card-text v-if="rows.length === 0" class="text-medium-emphasis">{{ emptyText }}</v-card-text>
    <v-table v-else density="compact">
      <thead>
        <tr>
          <th class="pos">#</th>
          <th>Jogador</th>
          <th v-for="column in columns" :key="column.key" class="text-end">{{ column.title }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.player_id" data-test="ranking-row">
          <td class="pos text-medium-emphasis">{{ index + 1 }}</td>
          <td class="player-cell">
            <div class="text-truncate">{{ row.player_name }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ row.team_nickname || row.team_name || 'Sem time' }}
            </div>
          </td>
          <td v-for="column in columns" :key="column.key" class="text-end tabular font-weight-bold">
            {{ row[column.key] }}
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-card>
</template>

<style scoped>
.pos {
  width: 32px;
}
.player-cell {
  max-width: 180px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
