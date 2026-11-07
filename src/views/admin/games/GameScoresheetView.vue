<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBackLink } from '@/composables/useBackLink'
import { useCrud } from '@/composables/useCrud'
import { useEventTypesStore } from '@/stores/eventTypes'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { gamesService } from '@/services/api/games.service'
import type { Game, GamePayload } from '@/types/game'
import GameScoresheet from '@/components/games/scoresheet/GameScoresheet.vue'
import { buildScoresheet, generatedAt } from '@/components/games/scoresheet/scoresheet'

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

const data = computed(() =>
  game.value
    ? buildScoresheet(game.value, {
        championship: league?.championship?.name,
        league: league?.name,
        groupsCount: league?.groups_count,
      })
    : null,
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

    <GameScoresheet
      v-else
      :data="data"
      :event-types="eventTypesStore.active"
      :generated-at="generated"
    >
      <div class="d-print-none d-flex flex-wrap align-center justify-center ga-2 mb-6">
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          :to="backLink"
          data-test="scoresheet-back"
        >
          Voltar para a partida
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-printer"
          data-test="scoresheet-print"
          @click="print"
        >
          Imprimir ou salvar PDF
        </v-btn>
      </div>
    </GameScoresheet>
  </v-app>
</template>
