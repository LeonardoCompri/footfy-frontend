<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePublicItem } from '@/composables/usePublicItem'
import { publicGamesService } from '@/services/api/publicGames.service'
import { formatMatchDate, gameStageLabel, gameStatusOption, hasPenalties } from '@/types/game'
import type { Game } from '@/types/game'
import GameShootoutCard from '@/components/games/GameShootoutCard.vue'
import { hasShootout } from '@/components/games/shootout'

const props = defineProps<{ id: string }>()

const router = useRouter()

const { item: game, loading, errorMessage, fetchOne } = usePublicItem<Game>(publicGamesService)

const homeName = computed(
  () => game.value?.homeTeam?.nickname || game.value?.homeTeam?.name || 'Mandante',
)
const awayName = computed(
  () => game.value?.awayTeam?.nickname || game.value?.awayTeam?.name || 'Visitante',
)
const hasScore = computed(() => game.value?.home_score != null && game.value?.away_score != null)
const status = computed(() => (game.value ? gameStatusOption(game.value.status) : null))
const info = computed(() => {
  const g = game.value
  if (!g) return ''
  return [gameStageLabel(g), formatMatchDate(g.match_date), g.stadium?.name]
    .filter(Boolean)
    .join(' · ')
})

function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    router.push({ name: 'championships-list' })
  }
}

onMounted(() => fetchOne(props.id))
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="goBack">
      Voltar
    </v-btn>

    <v-row v-if="loading" justify="center">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>

    <template v-else-if="game">
      <v-card class="mb-4" data-test="public-game-header">
        <v-card-text>
          <div class="d-flex flex-wrap align-center ga-2 mb-4">
            <span class="text-medium-emphasis" data-test="public-game-info">{{ info }}</span>
            <v-chip v-if="status" :color="status.color" size="small" variant="tonal">
              {{ status.title }}
            </v-chip>
          </div>
          <div class="scoreboard">
            <div class="home text-end">
              <div class="text-subtitle-1 text-sm-h5 font-weight-bold" data-test="public-game-home">
                {{ homeName }}
              </div>
              <div class="text-caption text-medium-emphasis">Mandante</div>
            </div>
            <div class="score text-center">
              <div class="text-h4 font-weight-bold text-no-wrap" data-test="public-game-score">
                <template v-if="hasScore">{{ game.home_score }} × {{ game.away_score }}</template>
                <span v-else class="text-medium-emphasis">×</span>
              </div>
              <div
                v-if="hasScore && hasPenalties(game)"
                class="text-caption text-medium-emphasis text-no-wrap"
                data-test="public-game-penalties"
              >
                Pênaltis {{ game.home_penalties }} × {{ game.away_penalties }}
              </div>
            </div>
            <div class="away">
              <div class="text-subtitle-1 text-sm-h5 font-weight-bold" data-test="public-game-away">
                {{ awayName }}
              </div>
              <div class="text-caption text-medium-emphasis">Visitante</div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <GameShootoutCard v-if="hasShootout(game)" :game="game" />
    </template>
  </v-container>
</template>

<style scoped>
.scoreboard {
  display: grid;
  grid-template-areas:
    'score score'
    'home away';
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 8px 16px;
}
@media (min-width: 600px) {
  .scoreboard {
    grid-template-areas: 'home score away';
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
  }
}
.home {
  grid-area: home;
}
.score {
  grid-area: score;
}
.away {
  grid-area: away;
}
.home,
.away {
  min-width: 0;
  overflow-wrap: break-word;
}
</style>
