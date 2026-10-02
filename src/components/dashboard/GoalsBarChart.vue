<script setup lang="ts">
import { computed } from 'vue'
import type { GoalsBucket } from '@/types/dashboard'
import { useChartPalette } from './chartPalette'

const props = defineProps<{ buckets: GoalsBucket[] }>()

const palette = useChartPalette()

const HEIGHT = 160
const TOP = 18
const BASE = 128
const SLOT = 36
// Rótulo de valor em cada barra só enquanto há espaço; acima disso o valor fica no tooltip
// e na tabela acessível (evita "um número em cada ponto").
const MAX_DIRECT_LABELS = 12

const bars = computed(() => {
  const max = Math.max(1, ...props.buckets.map((b) => b.goals))
  return props.buckets.map((bucket, index) => {
    const height = (bucket.goals / max) * (BASE - TOP)
    const x = index * SLOT + 6
    const width = SLOT - 12
    return {
      key: `${bucket.type}-${bucket.round ?? bucket.phase}`,
      label: bucket.type === 'round' ? `R${bucket.round}` : (bucket.phase ?? '—'),
      fullLabel: bucket.type === 'round' ? `Rodada ${bucket.round}` : (bucket.phase ?? '—'),
      goals: bucket.goals,
      x,
      width,
      y: BASE - height,
      path: roundedTopBar(x, BASE - height, width, height),
    }
  })
})

const width = computed(() => Math.max(320, bars.value.length * SLOT))
const showValues = computed(() => bars.value.length <= MAX_DIRECT_LABELS)

// Barra com cantos de 4px só no topo, ancorada reta na linha de base.
function roundedTopBar(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function shortLabel(label: string): string {
  return label.length > 6 ? `${label.slice(0, 5)}…` : label
}
</script>

<template>
  <div v-if="buckets.length === 0" class="text-medium-emphasis text-body-2 py-6 text-center">
    Nenhum gol registrado nesta liga ainda.
  </div>
  <div v-else class="chart-scroll">
    <svg
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      :style="{ minWidth: `${width}px` }"
      class="goals-chart"
      role="img"
      aria-label="Gráfico de barras de gols por rodada ou fase"
      data-test="goals-chart"
    >
      <line x1="0" :y1="BASE" :x2="width" :y2="BASE" :stroke="palette.baseline" stroke-width="1" />
      <v-tooltip v-for="bar in bars" :key="bar.key" location="top">
        <template #activator="{ props: activatorProps }">
          <g v-bind="activatorProps" class="bar" tabindex="0" data-test="goals-bar">
            <!-- alvo de hover maior que a marca -->
            <rect :x="bar.x - 4" :y="TOP" :width="bar.width + 8" :height="BASE - TOP" fill="transparent" />
            <path :d="bar.path" :fill="palette.series1" class="bar-mark" />
            <text
              v-if="showValues"
              :x="bar.x + bar.width / 2"
              :y="bar.y - 5"
              text-anchor="middle"
              class="bar-value"
            >
              {{ bar.goals }}
            </text>
            <text :x="bar.x + bar.width / 2" :y="BASE + 16" text-anchor="middle" class="bar-label">
              {{ shortLabel(bar.label) }}
            </text>
          </g>
        </template>
        <strong>{{ bar.goals }} {{ bar.goals === 1 ? 'gol' : 'gols' }}</strong>
        <span class="ml-1">· {{ bar.fullLabel }}</span>
      </v-tooltip>
    </svg>

    <table class="sr-only">
      <caption>Gols por rodada ou fase</caption>
      <thead>
        <tr><th>Rodada/fase</th><th>Gols</th></tr>
      </thead>
      <tbody>
        <tr v-for="bar in bars" :key="bar.key">
          <td>{{ bar.fullLabel }}</td>
          <td>{{ bar.goals }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.chart-scroll {
  overflow-x: auto;
}
.goals-chart {
  display: block;
  width: 100%;
  height: auto;
}
.bar {
  cursor: pointer;
  outline: none;
}
.bar-mark {
  transition: opacity 0.12s;
}
.bar:hover .bar-mark,
.bar:focus-visible .bar-mark {
  opacity: 0.75;
}
.bar-value {
  font-size: 11px;
  font-weight: 700;
  fill: rgb(var(--v-theme-on-surface));
  font-variant-numeric: tabular-nums;
}
.bar-label {
  font-size: 10px;
  fill: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
