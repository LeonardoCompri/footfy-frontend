<script setup lang="ts">
import { computed } from 'vue'
import type { ResultsSplit } from '@/types/dashboard'
import { useChartPalette } from './chartPalette'

const props = defineProps<{ split: ResultsSplit }>()

const palette = useChartPalette()

const total = computed(() => props.split.home_wins + props.split.draws + props.split.away_wins)

const segments = computed(() =>
  [
    { key: 'home', label: 'Vitórias do mandante', short: 'Mandante', value: props.split.home_wins, color: palette.value.series1 },
    { key: 'draw', label: 'Empates', short: 'Empate', value: props.split.draws, color: palette.value.series2 },
    { key: 'away', label: 'Vitórias do visitante', short: 'Visitante', value: props.split.away_wins, color: palette.value.series3 },
  ].map((segment) => ({
    ...segment,
    percent: total.value ? Math.round((segment.value / total.value) * 100) : 0,
  })),
)
</script>

<template>
  <div v-if="total === 0" class="text-medium-emphasis text-body-2 py-6 text-center">
    Nenhuma partida finalizada nesta liga ainda.
  </div>
  <div v-else data-test="results-split">
    <div class="segbar" role="img" :aria-label="segments.map((s) => `${s.label}: ${s.value}`).join(', ')">
      <template v-for="segment in segments" :key="segment.key">
        <v-tooltip v-if="segment.value > 0" location="top">
          <template #activator="{ props: activatorProps }">
            <div
              v-bind="activatorProps"
              class="segment"
              tabindex="0"
              :style="{ flexGrow: segment.value, background: segment.color }"
              data-test="results-segment"
            />
          </template>
          <strong>{{ segment.value }}</strong> ({{ segment.percent }}%) · {{ segment.label }}
        </v-tooltip>
      </template>
    </div>

    <div class="legend d-flex flex-wrap mt-3 text-body-2">
      <span v-for="segment in segments" :key="segment.key" class="d-inline-flex align-center ga-1">
        <span class="swatch" :style="{ background: segment.color }" />
        <span class="text-medium-emphasis">{{ segment.short }}</span>
        <strong class="tabular">{{ segment.value }}</strong>
        <span class="text-medium-emphasis">({{ segment.percent }}%)</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.segbar {
  display: flex;
  gap: 2px;
  height: 16px;
}
.segment {
  min-width: 6px;
  cursor: pointer;
  outline: none;
  transition: opacity 0.12s;
}
.segment:first-child {
  border-radius: 4px 0 0 4px;
}
.segment:last-child {
  border-radius: 0 4px 4px 0;
}
.segment:only-child {
  border-radius: 4px;
}
.segment:hover,
.segment:focus-visible {
  opacity: 0.75;
}
.legend {
  gap: 4px 16px;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
