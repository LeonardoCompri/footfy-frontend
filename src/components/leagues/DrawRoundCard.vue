<script setup lang="ts">
import { formatMatchDate, gameStatusOption } from '@/types/game'
import type { Game } from '@/types/game'
import type { Team } from '@/types/team'
import { groupName } from './leagueGroups'
import { TURN_LABELS, type DrawRoundView } from './leagueDraw'

defineProps<{
  view: DrawRoundView
  leagueId: number
  showGroupNames: boolean
}>()

function teamName(team: Team | undefined): string {
  return team?.nickname || team?.name || '—'
}

function gameRoute(leagueId: number, game: Game) {
  return { name: 'admin-games-detail', params: { leagueId, id: game.id } }
}
</script>

<template>
  <v-card data-test="draw-round">
    <v-card-title class="d-flex flex-wrap align-center ga-2">
      <span>Rodada {{ view.round }}</span>
      <v-chip
        v-if="view.turn !== 'single'"
        size="small"
        variant="tonal"
        :color="view.turn === 'second' ? 'info' : 'primary'"
        data-test="draw-round-turn"
      >
        {{ TURN_LABELS[view.turn] }}
      </v-chip>
    </v-card-title>
    <v-card-text class="pt-0">
      <v-row dense>
        <v-col
          v-for="group in view.groups"
          :key="group.group_number"
          cols="12"
          :md="view.groups.length > 1 ? 6 : 12"
          data-test="draw-round-group"
        >
          <div v-if="showGroupNames" class="text-subtitle-2 font-weight-bold mb-1">
            {{ groupName(group.group_number) }}
          </div>
          <v-list density="compact" class="py-0" border rounded>
            <v-list-item
              v-for="game in group.games"
              :key="game.id"
              :to="gameRoute(leagueId, game)"
              :aria-label="`Ver partida ${teamName(game.homeTeam)} × ${teamName(game.awayTeam)}`"
              data-test="draw-game"
            >
              <div class="d-flex align-center ga-2">
                <span class="flex-1-1-0 min-w-0 text-truncate text-end font-weight-medium">
                  {{ teamName(game.homeTeam) }}
                </span>
                <v-avatar size="24" color="surface-variant">
                  <v-img v-if="game.homeTeam?.logo" :src="game.homeTeam.logo" cover />
                  <v-icon v-else icon="mdi-shield-outline" size="16" />
                </v-avatar>
                <strong
                  v-if="game.home_score != null && game.away_score != null"
                  class="tabular text-no-wrap"
                  data-test="draw-game-score"
                >
                  {{ game.home_score }} × {{ game.away_score }}
                </strong>
                <span v-else class="text-medium-emphasis">×</span>
                <v-avatar size="24" color="surface-variant">
                  <v-img v-if="game.awayTeam?.logo" :src="game.awayTeam.logo" cover />
                  <v-icon v-else icon="mdi-shield-outline" size="16" />
                </v-avatar>
                <span class="flex-1-1-0 min-w-0 text-truncate font-weight-medium">
                  {{ teamName(game.awayTeam) }}
                </span>
              </div>
              <div class="d-flex flex-wrap justify-center align-center ga-2 mt-1">
                <v-chip :color="gameStatusOption(game.status).color" size="x-small" variant="tonal">
                  {{ gameStatusOption(game.status).title }}
                </v-chip>
                <span class="text-caption text-medium-emphasis" data-test="draw-game-date">
                  {{ formatMatchDate(game.match_date) }}
                </span>
              </div>
            </v-list-item>
            <v-list-item
              v-for="team in group.byes"
              :key="`bye-${team.id}`"
              prepend-icon="mdi-sleep"
              class="text-medium-emphasis"
              data-test="draw-bye"
            >
              <v-list-item-title class="text-body-2">
                Folga: {{ team.nickname || team.name }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="group.games.length === 0 && group.byes.length === 0"
              class="text-medium-emphasis"
            >
              <v-list-item-title class="text-body-2">Nenhuma partida encontrada.</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
