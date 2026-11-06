<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import type { LeagueFormat } from '@/types/championship'
import type { LeagueTable } from '@/types/leagueStats'
import KnockoutPhases from './KnockoutPhases.vue'
import StandingsTable from './StandingsTable.vue'

const props = defineProps<{
  format?: LeagueFormat | null
  load: () => Promise<LeagueTable>
}>()

const table = ref<LeagueTable | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    table.value = await props.load()
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
    <div v-else-if="table" class="d-flex flex-column ga-6">
      <section v-if="table.standings">
        <h2 v-if="format === 'hybrid'" class="text-h6 font-weight-bold mb-2">Fase de grupos</h2>
        <StandingsTable :rows="table.standings" />
      </section>
      <section v-if="table.phases">
        <h2 v-if="format === 'hybrid'" class="text-h6 font-weight-bold mb-2">Mata-mata</h2>
        <KnockoutPhases :phases="table.phases" />
      </section>
    </div>
  </div>
</template>
