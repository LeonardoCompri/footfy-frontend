<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import type { LeagueFormat } from '@/types/championship'
import type { LeagueTable } from '@/types/leagueStats'
import KnockoutPhases from './KnockoutPhases.vue'
import StandingsLegend from './StandingsLegend.vue'
import StandingsTable from './StandingsTable.vue'
import { groupName } from './leagueGroups'
import type { BracketConfig } from './leagueKnockout'
import { hasTied, standingGroups, ungroupedRows } from './standings'

const props = defineProps<{
  format?: LeagueFormat | null
  qualifiers?: number | null
  bracket?: BracketConfig | null
  load: () => Promise<LeagueTable>
}>()

const table = ref<LeagueTable | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)
const groups = computed(() => (table.value ? standingGroups(table.value) : []))
const ungrouped = computed(() => (table.value ? ungroupedRows(table.value) : []))

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
        <div v-if="groups.length > 1" class="d-flex flex-column ga-4" data-test="standings-groups">
          <StandingsTable
            v-for="group in groups"
            :key="group.group_number"
            :rows="group.standings"
            :title="groupName(group.group_number)"
            :qualifiers="qualifiers"
            hide-legend
            data-test="standings-group"
          />
          <StandingsTable
            v-if="ungrouped.length"
            :rows="ungrouped"
            title="Sem grupo"
            hide-legend
            data-test="standings-ungrouped"
          />
          <StandingsLegend
            class="px-1"
            :tiebreakers="table.tiebreakers"
            :tied="hasTied(groups) || ungrouped.some((row) => row.tied)"
            :qualifiers="qualifiers"
            per-group
          />
        </div>
        <StandingsTable
          v-else
          :rows="table.standings"
          :qualifiers="qualifiers"
          :tiebreakers="table.tiebreakers"
        />
      </section>
      <section v-if="table.phases">
        <h2 v-if="format === 'hybrid'" class="text-h6 font-weight-bold mb-2">Mata-mata</h2>
        <KnockoutPhases :phases="table.phases" :bracket="bracket" />
      </section>
    </div>
  </div>
</template>
