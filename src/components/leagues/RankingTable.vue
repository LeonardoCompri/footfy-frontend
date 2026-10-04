<script setup lang="ts">
import type { RankingPlayer } from '@/types/leagueStats'

export interface RankingColumn {
  key: string
  title: string
  // Largura fixa da coluna em px, incluindo padding (padrão 72).
  width?: number
  // Quando informado, o cabeçalho mostra só o ícone (title vira tooltip/aria-label).
  icon?: string
  iconColor?: string
}

// Ranking de jogadores da liga (artilharia, assistências, cartões): colunas numéricas por `columns`.
defineProps<{
  title: string
  icon: string
  rows: (RankingPlayer & Record<string, unknown>)[]
  columns: RankingColumn[]
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
    <!-- table-layout fixed: as colunas numéricas têm largura fixa e o nome do jogador ocupa o
         restante com ellipsis, então a tabela nunca passa da largura do card (sem rolagem). -->
    <v-table v-else density="compact" class="ranking-table">
      <colgroup>
        <col class="pos" />
        <col />
        <col v-for="column in columns" :key="column.key" :style="{ width: `${column.width ?? 72}px` }" />
      </colgroup>
      <thead>
        <tr>
          <th class="pos">#</th>
          <th>Jogador</th>
          <th
            v-for="column in columns"
            :key="column.key"
            class="num text-end"
            :title="column.icon ? column.title : undefined"
            data-test="ranking-column"
          >
            <v-icon v-if="column.icon" :icon="column.icon" :color="column.iconColor" size="18" :aria-label="column.title" />
            <template v-else>{{ column.title }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.player_id" data-test="ranking-row">
          <td class="pos text-medium-emphasis">{{ index + 1 }}</td>
          <td :title="row.player_name">
            <div class="text-truncate">{{ row.player_name }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ row.team_nickname || row.team_name || 'Sem time' }}
            </div>
          </td>
          <td v-for="column in columns" :key="column.key" class="num text-end tabular font-weight-bold">
            {{ row[column.key] }}
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-card>
</template>

<style scoped>
.ranking-table :deep(table) {
  table-layout: fixed;
}
col.pos {
  width: 48px;
}
.ranking-table th,
.ranking-table td {
  padding: 0 8px;
  white-space: nowrap;
}
.ranking-table th:first-child,
.ranking-table td:first-child {
  padding-left: 16px;
}
.ranking-table th:last-child,
.ranking-table td:last-child {
  padding-right: 16px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
