<script setup lang="ts">
import { computed } from 'vue'
import type { Tiebreaker } from '@/types/leagueRules'
import { tiebreakerLegend, TIED_LABEL } from './standings'

const props = defineProps<{
  tiebreakers?: Tiebreaker[] | null
  tied?: boolean
  qualifiers?: number | null
  perGroup?: boolean
}>()

const qualifiersText = computed(() => {
  const n = props.qualifiers
  if (!n) return null
  const who = n === 1 ? 'Classifica-se o 1º colocado' : `Classificam-se os ${n} primeiros`
  return `${who}${props.perGroup ? ' de cada grupo' : ''} para o mata-mata.`
})
</script>

<template>
  <div class="text-caption text-medium-emphasis" data-test="standings-legend">
    P pontos · J jogos · V vitórias · E empates · D derrotas · GP gols pró · GC gols contra · SG
    saldo de gols.
    <span data-test="standings-tiebreakers">{{ tiebreakerLegend(tiebreakers) }}</span>
    <div
      v-if="qualifiersText"
      class="d-flex align-center ga-2 mt-2"
      data-test="standings-legend-qualified"
    >
      <v-avatar size="16" color="success" variant="tonal" class="flex-shrink-0" />
      <span>{{ qualifiersText }}</span>
    </div>
    <div v-if="tied" class="d-flex align-center ga-2 mt-2" data-test="standings-legend-tied">
      <v-icon icon="mdi-approximately-equal" size="16" class="flex-shrink-0" />
      <span>{{ TIED_LABEL }}.</span>
    </div>
  </div>
</template>
