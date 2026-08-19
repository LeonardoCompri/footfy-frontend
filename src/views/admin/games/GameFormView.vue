<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { gamesService } from '@/services/api/games.service'
import { championshipsService } from '@/services/api/championships.service'
import { teamsService } from '@/services/api/teams.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import { GAME_STATUS_OPTIONS } from '@/types/game'
import type { Game, GamePayload } from '@/types/game'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import type { Team, TeamPayload } from '@/types/team'
import type { Stadium, StadiumPayload } from '@/types/stadium'
import PageHeader from '@/components/common/PageHeader.vue'
import GameEventsPanel from '@/components/games/GameEventsPanel.vue'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<Game, GamePayload>(
  gamesService,
)
const { items: championships, fetchAll: fetchAllChampionships } = useCrud<
  Championship,
  ChampionshipPayload
>(championshipsService)
const { items: teams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const { items: stadiums, fetchAll: fetchAllStadiums } = useCrud<Stadium, StadiumPayload>(
  stadiumsService,
)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Partida' : 'Nova Partida'))
const initializing = ref(isEditing.value)
const savedGame = ref<Game | null>(null)

const form = reactive<GamePayload>({
  championship_id: 0,
  home_team_id: 0,
  away_team_id: 0,
  stadium_id: null,
  match_date: null,
  home_score: null,
  away_score: null,
  round: null,
  status: 'scheduled',
})

function teamName(teamId: number): string {
  return teams.value.find((team) => team.id === teamId)?.name ?? '—'
}

const sameTeamError = computed(
  () => form.home_team_id !== 0 && form.home_team_id === form.away_team_id,
)

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

onMounted(async () => {
  fetchAllChampionships()
  fetchAllStadiums()
  if (!props.id) {
    fetchAllTeams()
    return
  }
  try {
    // Aguarda times junto da partida: o painel de eventos depende dos nomes
    // dos times já resolvidos e do time efetivamente salvo (não do form).
    const [game] = await Promise.all([fetchOne(props.id), fetchAllTeams()])
    if (game) {
      savedGame.value = game
      form.championship_id = game.championship_id
      form.home_team_id = game.home_team_id
      form.away_team_id = game.away_team_id
      form.stadium_id = game.stadium_id
      form.match_date = game.match_date
      form.home_score = game.home_score
      form.away_score = game.away_score
      form.round = game.round
      form.status = game.status
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit() {
  if (sameTeamError.value) return
  form.home_score = toNullableNumber(form.home_score)
  form.away_score = toNullableNumber(form.away_score)
  form.round = toNullableNumber(form.round)
  const result = await save(form, props.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Partida atualizada com sucesso.' : 'Partida criada com sucesso.')
    router.push({ name: 'admin-games-list' })
  }
}
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text v-if="initializing" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
      <v-card-text v-else>
        <v-form @submit.prevent="handleSubmit">
          <v-autocomplete
            v-model="form.championship_id"
            :items="championships"
            item-title="name"
            item-value="id"
            label="Campeonato"
            :error-messages="fieldErrors.championship_id"
            class="mb-2"
          />
          <v-autocomplete
            v-model="form.home_team_id"
            :items="teams"
            item-title="name"
            item-value="id"
            label="Time Mandante"
            :error-messages="fieldErrors.home_team_id"
            class="mb-2"
          />
          <v-autocomplete
            v-model="form.away_team_id"
            :items="teams"
            item-title="name"
            item-value="id"
            label="Time Visitante"
            :error-messages="sameTeamError ? ['O time visitante deve ser diferente do mandante.'] : fieldErrors.away_team_id"
            class="mb-2"
          />
          <v-autocomplete
            v-model="form.stadium_id"
            :items="stadiums"
            item-title="name"
            item-value="id"
            label="Estádio"
            clearable
            :error-messages="fieldErrors.stadium_id"
            class="mb-2"
          />
          <v-text-field
            v-model.number="form.round"
            label="Rodada"
            type="number"
            min="1"
            :error-messages="fieldErrors.round"
            class="mb-2"
          />
          <v-text-field
            v-model="form.match_date"
            label="Data da partida"
            type="datetime-local"
            :error-messages="fieldErrors.match_date"
            class="mb-2"
          />
          <v-select
            v-model="form.status"
            :items="GAME_STATUS_OPTIONS"
            item-title="title"
            item-value="value"
            label="Status"
            :error-messages="fieldErrors.status"
            class="mb-2"
          />
          <v-text-field
            v-model.number="form.home_score"
            label="Placar Mandante"
            type="number"
            min="0"
            :error-messages="fieldErrors.home_score"
            class="mb-2"
          />
          <v-text-field
            v-model.number="form.away_score"
            label="Placar Visitante"
            type="number"
            min="0"
            :error-messages="fieldErrors.away_score"
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-games-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading" :disabled="sameTeamError">
              Salvar
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>

    <GameEventsPanel
      v-if="isEditing && !initializing && props.id && savedGame"
      :game-id="props.id"
      :home-team-id="savedGame.home_team_id"
      :away-team-id="savedGame.away_team_id"
      :home-team-name="teamName(savedGame.home_team_id)"
      :away-team-name="teamName(savedGame.away_team_id)"
    />
  </div>
</template>
