<script setup lang="ts">
import { computed } from 'vue'
import type { Tiebreaker } from '@/types/leagueRules'
import type { StandingRow } from '@/types/leagueStats'
import StandingsLegend from './StandingsLegend.vue'
import { TIED_LABEL } from './standings'

const props = defineProps<{
  rows: StandingRow[]
  title?: string | null
  qualifiers?: number | null
  tiebreakers?: Tiebreaker[] | null
  hideLegend?: boolean
}>()

const hasTied = computed(() => props.rows.some((row) => row.tied))

function qualifies(index: number): boolean {
  return !!props.qualifiers && index < props.qualifiers
}

function initials(row: StandingRow): string {
  return (row.team.nickname || row.team.name).slice(0, 2).toUpperCase()
}
</script>

<template>
  <v-card>
    <v-card-title v-if="title" class="text-subtitle-1 font-weight-bold" data-test="standings-title">
      {{ title }}
    </v-card-title>
    <v-card-text v-if="rows.length === 0" class="text-medium-emphasis text-center">
      {{ title ? 'Nenhum time neste grupo ainda.' : 'Nenhum time vinculado a esta liga ainda.' }}
    </v-card-text>
    <template v-else>
      <v-table density="comfortable" data-test="standings-table">
        <thead>
          <tr>
            <th class="text-center pos">#</th>
            <th>Time</th>
            <th class="text-center">P</th>
            <th class="text-center">J</th>
            <th class="text-center d-none d-sm-table-cell">V</th>
            <th class="text-center d-none d-sm-table-cell">E</th>
            <th class="text-center d-none d-sm-table-cell">D</th>
            <th class="text-center d-none d-md-table-cell">GP</th>
            <th class="text-center d-none d-md-table-cell">GC</th>
            <th class="text-center">SG</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.team_id" data-test="standings-row">
            <td class="text-center pos font-weight-bold">
              <v-avatar
                v-if="qualifies(index)"
                size="24"
                color="success"
                variant="tonal"
                class="text-caption font-weight-bold"
                data-test="standings-qualified"
              >
                {{ index + 1 }}
              </v-avatar>
              <template v-else>{{ index + 1 }}</template>
            </td>
            <td>
              <div class="d-flex align-center ga-2 team-cell">
                <v-avatar size="28" rounded="lg" color="primary" variant="tonal">
                  <v-img v-if="row.team.logo" :src="row.team.logo" cover data-test="team-logo" />
                  <span v-else class="text-caption font-weight-bold">{{ initials(row) }}</span>
                </v-avatar>
                <span class="text-truncate">
                  <span class="d-sm-none">{{ row.team.nickname || row.team.name }}</span>
                  <span class="d-none d-sm-inline">{{ row.team.name }}</span>
                </span>
                <v-tooltip v-if="row.tied" :text="TIED_LABEL" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon
                      v-bind="tooltipProps"
                      icon="mdi-approximately-equal"
                      size="16"
                      class="flex-shrink-0 text-medium-emphasis"
                      tabindex="0"
                      :aria-label="TIED_LABEL"
                      data-test="standings-tied"
                    />
                  </template>
                </v-tooltip>
              </div>
            </td>
            <td class="text-center font-weight-bold tabular">{{ row.points }}</td>
            <td class="text-center tabular">{{ row.played }}</td>
            <td class="text-center tabular d-none d-sm-table-cell">{{ row.wins }}</td>
            <td class="text-center tabular d-none d-sm-table-cell">{{ row.draws }}</td>
            <td class="text-center tabular d-none d-sm-table-cell">{{ row.losses }}</td>
            <td class="text-center tabular d-none d-md-table-cell">{{ row.goals_for }}</td>
            <td class="text-center tabular d-none d-md-table-cell">{{ row.goals_against }}</td>
            <td class="text-center tabular">{{ row.goal_difference }}</td>
          </tr>
        </tbody>
      </v-table>
      <v-card-text v-if="!hideLegend" class="pt-2">
        <StandingsLegend :tiebreakers="tiebreakers" :tied="hasTied" :qualifiers="qualifiers" />
      </v-card-text>
    </template>
  </v-card>
</template>

<style scoped>
.pos {
  width: 40px;
}
.team-cell {
  min-width: 0;
  max-width: 280px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
