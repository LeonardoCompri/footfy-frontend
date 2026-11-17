<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { extractErrorMessage } from '@/composables/useCrud'
import type { PageParams, Paginated, PaginationMeta } from '@/types/api'
import { GAME_STATUS_OPTIONS, gameStageLabel, scoreLabel } from '@/types/game'
import type { Game } from '@/types/game'

const PER_PAGE = 20

const props = defineProps<{
  load: (params: PageParams) => Promise<Paginated<Game>>
}>()

const router = useRouter()
const games = ref<Game[]>([])
const meta = ref<PaginationMeta | null>(null)
const page = ref(1)
const loading = ref(true)
const errorMessage = ref<string | null>(null)
let requestId = 0

async function fetchPage() {
  const id = ++requestId
  loading.value = true
  errorMessage.value = null
  try {
    const result = await props.load({ page: page.value, per_page: PER_PAGE })
    if (id !== requestId) return
    games.value = result.data
    meta.value = result.meta
  } catch (err) {
    if (id === requestId) errorMessage.value = extractErrorMessage(err)
  } finally {
    if (id === requestId) loading.value = false
  }
}

function statusLabel(status: Game['status']): string {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status)?.title ?? status
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

function goToGame(id: number) {
  router.push({ name: 'games-detail', params: { id } })
}

watch(page, fetchPage)
onMounted(fetchPage)
</script>

<template>
  <div>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
      {{ errorMessage }}
    </v-alert>
    <div v-if="loading && !meta" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-alert v-else-if="meta?.total === 0" type="info" variant="tonal">
      Nenhuma partida cadastrada para esta liga ainda.
    </v-alert>
    <template v-else-if="meta">
      <v-progress-linear :active="loading" indeterminate color="primary" />
      <v-table data-test="public-games-table">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Mandante</th>
            <th>Placar</th>
            <th>Visitante</th>
            <th>Data</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="game in games"
            :key="game.id"
            class="cursor-pointer"
            @click="goToGame(game.id)"
          >
            <td>{{ gameStageLabel(game) }}</td>
            <td>{{ game.homeTeam?.name ?? '—' }}</td>
            <td class="text-no-wrap">{{ scoreLabel(game, '— × —') }}</td>
            <td>{{ game.awayTeam?.name ?? '—' }}</td>
            <td>{{ formatDate(game.match_date) }}</td>
            <td>{{ statusLabel(game.status) }}</td>
          </tr>
        </tbody>
      </v-table>
      <v-pagination
        v-if="meta.last_page > 1"
        v-model="page"
        :length="meta.last_page"
        density="comfortable"
        class="mt-4"
        data-test="public-games-pagination"
      />
    </template>
  </div>
</template>
