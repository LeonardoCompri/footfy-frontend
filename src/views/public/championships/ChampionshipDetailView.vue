<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { championshipsService } from '@/services/api/championships.service'
import { gamesService } from '@/services/api/games.service'
import { teamsService } from '@/services/api/teams.service'
import { GAME_STATUS_OPTIONS } from '@/types/game'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import type { Game, GamePayload } from '@/types/game'
import type { Team, TeamPayload } from '@/types/team'

const props = defineProps<{ id: string }>()

const { fetchOne, loading, errorMessage } = useCrud<Championship, ChampionshipPayload>(
  championshipsService,
)
const { items: allGames, fetchAll: fetchAllGames } = useCrud<Game, GamePayload>(gamesService)
const { items: allTeams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const championship = ref<Championship | null>(null)

const games = computed(() =>
  allGames.value
    .filter((game) => game.championship_id === Number(props.id))
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0)),
)

function teamName(id: number): string {
  return allTeams.value.find((t) => t.id === id)?.name ?? '—'
}

function statusLabel(status: Game['status']): string {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status)?.title ?? status
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

onMounted(async () => {
  championship.value = await fetchOne(props.id)
  await Promise.all([fetchAllGames(), fetchAllTeams()])
})
</script>

<template>
  <v-container class="py-8">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-4"
      :to="{ name: 'championships-list' }"
    >
      Voltar
    </v-btn>

    <v-row v-if="loading" justify="center">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>

    <v-card v-else-if="championship">
      <v-card-item>
        <v-card-title class="text-h4">{{ championship.name }}</v-card-title>
        <v-card-subtitle v-if="championship.organizer">
          Organização: {{ championship.organizer }}
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <p><strong>Início:</strong> {{ formatDate(championship.start_date) }}</p>
        <p><strong>Término:</strong> {{ formatDate(championship.end_date) }}</p>
      </v-card-text>
    </v-card>

    <h2 v-if="championship" class="text-h5 font-weight-bold mb-4 mt-6">Jogos</h2>

    <v-alert v-if="championship && games.length === 0" type="info" variant="tonal">
      Nenhum jogo cadastrado para este campeonato ainda.
    </v-alert>

    <v-table v-else-if="championship">
      <thead>
        <tr>
          <th>Rodada</th>
          <th>Mandante</th>
          <th>Placar</th>
          <th>Visitante</th>
          <th>Data</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="game in games" :key="game.id">
          <td>{{ game.round ?? '—' }}</td>
          <td>{{ teamName(game.home_team_id) }}</td>
          <td>{{ game.home_score ?? '—' }} x {{ game.away_score ?? '—' }}</td>
          <td>{{ teamName(game.away_team_id) }}</td>
          <td>{{ formatDate(game.match_date) }}</td>
          <td>{{ statusLabel(game.status) }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
