<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { GAME_LEG_OPTIONS } from '@/types/game'
import type { KnockoutPhase, KnockoutTieLeg } from '@/types/leagueStats'
import {
  bracketSections,
  legScore,
  tieOutcome,
  tieTeamName,
  type BracketConfig,
} from './leagueKnockout'

const props = defineProps<{
  phases: KnockoutPhase[]
  bracket?: BracketConfig | null
  legRoute?: (gameId: number) => RouteLocationRaw
}>()

const sections = computed(() => bracketSections(props.phases, props.bracket ?? null))

function legTitle(leg: KnockoutTieLeg): string {
  return GAME_LEG_OPTIONS.find((option) => option.value === leg.leg)?.title ?? 'Jogo único'
}

function legLink(leg: KnockoutTieLeg) {
  return props.legRoute ? { to: props.legRoute(leg.id) } : {}
}
</script>

<template>
  <div v-if="sections.length === 0" class="text-medium-emphasis text-body-2 py-6 text-center">
    Nenhuma partida de mata-mata cadastrada ainda.
  </div>
  <div v-else class="d-flex flex-column ga-6" data-test="knockout-phases">
    <section v-for="section in sections" :key="section.key" data-test="knockout-phase">
      <h3 class="text-subtitle-1 font-weight-bold mb-2" data-test="knockout-phase-title">
        {{ section.title }}
      </h3>
      <v-row>
        <v-col
          v-for="(tie, index) in section.ties"
          :key="tie.tie_key ?? index"
          cols="12"
          sm="6"
          lg="4"
        >
          <v-card class="h-100" data-test="knockout-tie">
            <div
              v-if="tie.tie_key"
              class="text-caption text-medium-emphasis px-4 pt-2"
              data-test="knockout-tie-key"
            >
              {{ tie.tie_key }}
            </div>
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
              <component
                :is="legRoute ? 'router-link' : 'div'"
                v-for="leg in tie.legs"
                :key="leg.id"
                v-bind="legLink(leg)"
                class="d-flex justify-space-between ga-2 leg"
                :class="{ 'leg--link': legRoute }"
                data-test="knockout-leg"
              >
                <span class="text-medium-emphasis text-truncate">
                  {{ legTitle(leg) }} · {{ tieTeamName(tie, leg.home_team_id) }} ×
                  {{ tieTeamName(tie, leg.away_team_id) }}
                </span>
                <span class="tabular text-no-wrap" data-test="knockout-leg-score">
                  {{ legScore(leg) }}
                </span>
              </component>
              <div
                class="d-flex align-start ga-1 mt-2 font-weight-medium"
                :class="`text-${tieOutcome(tie, section.stage).color}`"
                data-test="knockout-tie-outcome"
              >
                <v-icon :icon="tieOutcome(tie, section.stage).icon" size="16" class="mt-half" />
                <span>{{ tieOutcome(tie, section.stage).text }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col v-for="tie in section.future" :key="tie.tie_key" cols="12" sm="6" lg="4">
          <v-card variant="outlined" class="h-100 border-dashed" data-test="knockout-future-tie">
            <div class="text-caption text-medium-emphasis px-4 pt-2">{{ tie.tie_key }}</div>
            <v-card-text class="pt-1 text-body-2">
              <div class="text-truncate" data-test="knockout-future-home">{{ tie.home }}</div>
              <div class="text-medium-emphasis">×</div>
              <div class="text-truncate" data-test="knockout-future-away">{{ tie.away }}</div>
              <div class="text-caption text-medium-emphasis mt-2">A definir</div>
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
.leg--link {
  color: inherit;
  text-decoration: none;
}
.leg--link:hover span:first-child {
  text-decoration: underline;
}
.mt-half {
  margin-top: 2px;
}
</style>
