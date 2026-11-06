<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { formatMatchDate, gameStageLabel } from '@/types/game'
import type { DashboardGame } from '@/types/dashboard'

defineProps<{
  games: DashboardGame[]
  leagueId: number
  emptyMessage: string
}>()

const canOpen = useAuthStore().hasPermission('game:read')

function teamLabel(team: DashboardGame['home_team']): string {
  return team?.nickname || team?.name || 'A definir'
}

</script>

<template>
  <v-card>
    <v-list v-if="games.length" density="compact" class="py-0">
      <v-list-item
        v-for="game in games"
        :key="game.id"
        :to="
          canOpen ? { name: 'admin-games-detail', params: { leagueId, id: game.id } } : undefined
        "
        data-test="mini-game"
      >
        <v-list-item-title>
          {{ teamLabel(game.home_team) }}
          <span class="text-medium-emphasis">×</span>
          {{ teamLabel(game.away_team) }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ gameStageLabel(game) }}</v-list-item-subtitle>
        <template #append>
          <strong v-if="game.status === 'finished'" class="tabular">
            {{ game.home_score ?? 0 }} × {{ game.away_score ?? 0 }}
          </strong>
          <span v-else class="text-body-2 text-medium-emphasis">{{ formatMatchDate(game.match_date) }}</span>
        </template>
      </v-list-item>
    </v-list>
    <v-card-text v-else class="text-medium-emphasis text-center">{{ emptyMessage }}</v-card-text>
  </v-card>
</template>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
