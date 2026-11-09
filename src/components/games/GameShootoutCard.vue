<script setup lang="ts">
import { computed } from 'vue'
import type { Game } from '@/types/game'
import PenaltyShootoutGrid from './PenaltyShootoutGrid.vue'
import { gridKicks, savedKicks, shootoutTeams } from './shootout'

const props = defineProps<{ game: Game }>()

const teams = computed(() => shootoutTeams(props.game))
const kicks = computed(() => gridKicks(savedKicks(props.game)))
</script>

<template>
  <v-card class="mb-4" data-test="game-shootout">
    <v-card-title class="text-subtitle-1 font-weight-bold">Disputa de pênaltis</v-card-title>
    <v-card-text>
      <PenaltyShootoutGrid
        :home="teams.home"
        :away="teams.away"
        :kicks="kicks"
        :home-penalties="game.home_penalties"
        :away-penalties="game.away_penalties"
      />
    </v-card-text>
  </v-card>
</template>
