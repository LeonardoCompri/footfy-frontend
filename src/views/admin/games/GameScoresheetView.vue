<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBackLink } from '@/composables/useBackLink'
import { useCrud } from '@/composables/useCrud'
import { useEventTypesStore } from '@/stores/eventTypes'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { gamesService } from '@/services/api/games.service'
import type { Game, GamePayload } from '@/types/game'
import GameScoresheet from '@/components/games/scoresheet/GameScoresheet.vue'
import {
  buildScoresheet,
  generatedAt,
  rostersAboveLimit,
  scoresheetEventTypes,
  scoresheetFilled,
} from '@/components/games/scoresheet/scoresheet'

const props = defineProps<{ id: string }>()

const leagueContext = useLeagueContextStore()
const eventTypesStore = useEventTypesStore()
const { errorMessage, fetchOne } = useCrud<Game, GamePayload>(gamesService)

const leagueId = leagueContext.activeLeagueId as number
const league = leagueContext.activeLeague
const backLink = useBackLink({ name: 'admin-games-detail', params: { leagueId, id: props.id } })

const game = ref<Game | null>(null)
const initializing = ref(true)
const loadError = ref<string | null>(null)
const generated = generatedAt(new Date())
const mode = ref<'filled' | 'blank'>('filled')

const data = computed(() =>
  game.value
    ? buildScoresheet(
        game.value,
        {
          championship: league?.championship?.name,
          league: league?.name,
          groupsCount: league?.groups_count,
        },
        mode.value === 'blank',
      )
    : null,
)
const rostersOverLimit = computed(() => (data.value ? rostersAboveLimit(data.value) : []))
const canPrintBlank = computed(() => !!game.value && scoresheetFilled(game.value))
const eventTypes = computed(() =>
  scoresheetEventTypes(eventTypesStore.active, data.value?.events ?? [], eventTypesStore.bySlug),
)

const pageStyle = document.createElement('style')
pageStyle.textContent = '@page { size: A4 landscape; margin: 0; }'
const previousTitle = document.title

async function print() {
  await document.fonts?.ready
  window.print()
}

onMounted(async () => {
  document.head.appendChild(pageStyle)
  try {
    const [loaded] = await Promise.all([
      fetchOne(props.id),
      eventTypesStore.load().catch(() => {
        loadError.value =
          eventTypesStore.errorMessage ?? 'Não foi possível carregar os tipos de evento.'
      }),
    ])
    if (loaded) {
      game.value = loaded
      const sheet = buildScoresheet(loaded)
      document.title = `Súmula ${sheet.code} - ${sheet.home.name} x ${sheet.away.name}`
    }
  } finally {
    initializing.value = false
  }
})

onBeforeUnmount(() => {
  pageStyle.remove()
  document.title = previousTitle
})
</script>

<template>
  <v-app theme="footfyLight">
    <div v-if="initializing" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="!data || loadError" class="pa-4">
      <v-alert type="error" variant="tonal" class="mb-4" data-test="scoresheet-error">
        {{ loadError ?? errorMessage ?? 'Partida não encontrada.' }}
      </v-alert>
      <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="backLink">
        Voltar para a partida
      </v-btn>
    </div>

    <GameScoresheet v-else :data="data" :event-types="eventTypes" :generated-at="generated">
      <div class="d-print-none d-flex flex-wrap align-center justify-center ga-2 mb-6">
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          :to="backLink"
          data-test="scoresheet-back"
        >
          Voltar para a partida
        </v-btn>
        <v-btn-toggle
          v-if="canPrintBlank"
          v-model="mode"
          mandatory
          divided
          color="primary"
          variant="outlined"
          density="compact"
          aria-label="Modelo da súmula"
          data-test="scoresheet-mode"
        >
          <v-btn value="filled" data-test="scoresheet-mode-filled">Preenchida</v-btn>
          <v-btn value="blank" data-test="scoresheet-mode-blank">Em branco</v-btn>
        </v-btn-toggle>
        <v-btn
          color="primary"
          prepend-icon="mdi-printer"
          data-test="scoresheet-print"
          @click="print"
        >
          Imprimir ou salvar PDF
        </v-btn>
      </div>
      <v-alert
        v-if="rostersOverLimit.length"
        type="warning"
        variant="tonal"
        class="d-print-none mx-auto mb-6"
        max-width="800"
        data-test="scoresheet-roster-limit"
      >
        A liga permite {{ data.rosterRows }} jogadores por time, mas
        {{
          rostersOverLimit.map((team) => `${team.name} tem ${team.players} atletas`).join(' e ')
        }}. A relação continua em uma folha extra para nenhum atleta ficar de fora.
      </v-alert>
    </GameScoresheet>
  </v-app>
</template>
