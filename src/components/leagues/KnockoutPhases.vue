<script setup lang="ts">
import { formatMatchDate, GAME_LEG_OPTIONS } from '@/types/game'
import type { KnockoutPhase, KnockoutTie, KnockoutTieLeg } from '@/types/leagueStats'

defineProps<{ phases: KnockoutPhase[] }>()

function teamName(tie: KnockoutTie, teamId: number): string {
  const team = tie.teams.find((t) => t.team_id === teamId)
  return team?.nickname || team?.name || 'A definir'
}

function legTitle(leg: KnockoutTieLeg): string {
  return GAME_LEG_OPTIONS.find((option) => option.value === leg.leg)?.title ?? 'Jogo único'
}

function legScore(leg: KnockoutTieLeg): string {
  if (leg.status === 'finished' && leg.home_score !== null && leg.away_score !== null) {
    return `${leg.home_score} × ${leg.away_score}`
  }
  return formatMatchDate(leg.match_date, false)
}

function tieStatus(tie: KnockoutTie): { text: string; color: string } {
  if (!tie.decided) return { text: 'Em disputa', color: 'info' }
  if (tie.winner_team_id === null) return { text: 'Agregado empatado', color: 'warning' }
  return { text: `Classificado: ${teamName(tie, tie.winner_team_id)}`, color: 'success' }
}
</script>

<template>
  <div v-if="phases.length === 0" class="text-medium-emphasis text-body-2 py-6 text-center">
    Nenhuma partida de mata-mata cadastrada ainda.
  </div>
  <div v-else class="d-flex flex-column ga-6" data-test="knockout-phases">
    <section v-for="phase in phases" :key="`${phase.phase_order}-${phase.phase}`" data-test="knockout-phase">
      <h3 class="text-subtitle-1 font-weight-bold mb-2">{{ phase.phase }}</h3>
      <v-row>
        <v-col v-for="(tie, index) in phase.ties" :key="tie.tie_key ?? index" cols="12" sm="6" lg="4">
          <v-card class="h-100" data-test="knockout-tie">
            <v-list density="compact" class="py-1">
              <v-list-item v-for="team in tie.teams" :key="team.team_id">
                <v-list-item-title
                  :class="{ 'font-weight-bold': tie.winner_team_id === team.team_id }"
                  class="d-flex align-center ga-1"
                >
                  <v-icon
                    v-if="tie.winner_team_id === team.team_id"
                    icon="mdi-check-circle"
                    color="success"
                    size="16"
                  />
                  {{ team.nickname || team.name || 'A definir' }}
                </v-list-item-title>
                <template #append>
                  <strong class="tabular">{{ team.aggregate_score }}</strong>
                </template>
              </v-list-item>
            </v-list>
            <v-divider />
            <v-card-text class="py-2 text-body-2">
              <div v-for="leg in tie.legs" :key="leg.id" class="d-flex justify-space-between ga-2">
                <span class="text-medium-emphasis text-truncate">
                  {{ legTitle(leg) }} · {{ teamName(tie, leg.home_team_id) }} × {{ teamName(tie, leg.away_team_id) }}
                </span>
                <span class="tabular text-no-wrap">{{ legScore(leg) }}</span>
              </div>
              <v-chip :color="tieStatus(tie).color" size="small" variant="tonal" class="mt-2">
                {{ tieStatus(tie).text }}
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </section>
  </div>
</template>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
