<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { gameEventsService } from '@/services/api/gameEvents.service'
import type { GameEvent } from '@/types/gameEvent'
import StatTiles from '@/components/common/StatTiles.vue'
import { playerEventCounts } from '@/components/teams/stats'

const props = defineProps<{
  playerId: number
  leagueId: number
}>()

const events = ref<GameEvent[]>([])
const loading = ref(true)
const errorMessage = ref<string | null>(null)

const tiles = computed(() => {
  const counts = playerEventCounts(events.value, props.playerId)
  return [
    { label: 'Gols', value: counts.goals },
    { label: 'Assistências', value: counts.assists },
    { label: 'Cartões amarelos', value: counts.yellowCards },
    { label: 'Cartões vermelhos', value: counts.redCards },
  ]
})

onMounted(async () => {
  try {
    // GET /game-events não filtra por liga: restringe aqui à liga ativa.
    const allEvents = await gameEventsService.list()
    events.value = allEvents.filter((event) => event.league_id === props.leagueId)
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
    <template v-else>
      <StatTiles :items="tiles" data-test="player-stats" />
      <p class="text-caption text-medium-emphasis mt-2">
        Contabiliza gols, assistências e cartões registrados nas partidas da liga atual.
      </p>
    </template>
  </div>
</template>
