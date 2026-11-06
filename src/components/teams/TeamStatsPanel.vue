<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { gamesService } from '@/services/api/games.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { useEventTypesStore } from '@/stores/eventTypes'
import type { Game } from '@/types/game'
import type { GameEvent } from '@/types/gameEvent'
import type { Player } from '@/types/player'
import StatTiles from '@/components/common/StatTiles.vue'
import { cardCounts, playerEventCounts, teamRecord } from './stats'

const props = defineProps<{
  teamId: number
  leagueId: number
  players: Player[]
}>()

const games = ref<Game[]>([])
const events = ref<GameEvent[]>([])
const loading = ref(true)
const errorMessage = ref<string | null>(null)
const eventTypes = useEventTypesStore()

const tiles = computed(() => {
  const record = teamRecord(games.value, props.teamId)
  const cards = cardCounts(
    events.value.filter((event) => event.team_id === props.teamId),
    eventTypes.bySlug,
  )
  return [
    { label: 'Jogos', value: record.played },
    { label: 'Vitórias', value: record.wins },
    { label: 'Empates', value: record.draws },
    { label: 'Derrotas', value: record.losses },
    { label: 'Gols pró', value: record.goalsFor },
    { label: 'Gols contra', value: record.goalsAgainst },
    { label: 'Cartões amarelos', value: cards.yellow },
    { label: 'Cartões vermelhos', value: cards.red },
  ]
})

const scorers = computed(() =>
  props.players
    .map((player) => ({ player, ...playerEventCounts(events.value, player.id, eventTypes.bySlug) }))
    .filter((row) => row.goals > 0 || row.assists > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists),
)

onMounted(async () => {
  try {
    const [leagueGames, allEvents] = await Promise.all([
      gamesService.listAll({
        league_id: props.leagueId,
        team_id: props.teamId,
        status: 'finished',
      }),
      gameEventsService.list(),
      eventTypes.load(),
    ])
    games.value = leagueGames
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
      <StatTiles :items="tiles" class="mb-4" data-test="team-stats" />
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">Artilharia do time na liga</v-card-title>
        <v-card-text v-if="scorers.length === 0" class="text-medium-emphasis">
          Nenhum gol registrado para este time na liga ainda.
        </v-card-text>
        <v-table v-else density="comfortable">
          <thead>
            <tr>
              <th>Jogador</th>
              <th class="text-end">Gols</th>
              <th class="text-end">Assist.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in scorers" :key="row.player.id">
              <td>{{ row.player.name }}</td>
              <td class="text-end">{{ row.goals }}</td>
              <td class="text-end">{{ row.assists }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>
  </div>
</template>
