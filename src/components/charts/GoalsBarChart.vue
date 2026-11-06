<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { GoalsBucket } from '@/types/dashboard'
import { useChartPalette } from './chartPalette'

const props = defineProps<{ buckets: GoalsBucket[] }>()

const palette = useChartPalette()

const HEIGHT = 180
const TOP = 22
const BASE = 150
const MIN_SLOT = 36
const MAX_BAR_WIDTH = 48
const MAX_DIRECT_LABELS = 12

const container = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!container.value) return
  containerWidth.value = container.value.clientWidth
  observer = new ResizeObserver(([entry]) => {
    containerWidth.value = entry.contentRect.width
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const activeIndex = ref<number | null>(null)

const width = computed(() =>
  Math.max(containerWidth.value || 320, props.buckets.length * MIN_SLOT),
)
const slot = computed(() => width.value / Math.max(1, props.buckets.length))

const bars = computed(() => {
  const max = Math.max(1, ...props.buckets.map((b) => b.goals))
  return props.buckets.map((bucket, index) => {
    const height = (bucket.goals / max) * (BASE - TOP)
    const width = Math.min(MAX_BAR_WIDTH, slot.value * 0.6)
    const x = index * slot.value + (slot.value - width) / 2
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

const showValues = computed(() => bars.value.length <= MAX_DIRECT_LABELS)

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
  <div v-else ref="container" class="chart-scroll">
    <div class="chart-canvas" :style="{ width: `${width}px`, height: `${HEIGHT}px` }">
      <svg
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        :width="width"
        :height="HEIGHT"
        class="goals-chart"
        role="img"
        aria-label="Gráfico de barras de gols por rodada ou fase"
        data-test="goals-chart"
      >
        <line x1="0" :y1="BASE" :x2="width" :y2="BASE" :stroke="palette.baseline" stroke-width="1" />
        <g v-for="(bar, index) in bars" :key="bar.key">
          <path
            :d="bar.path"
            :fill="palette.series1"
            class="bar-mark"
            :class="{ 'is-active': activeIndex === index }"
          />
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
      </svg>

      <v-tooltip v-for="(bar, index) in bars" :key="bar.key" location="end">
        <template #activator="{ props: activatorProps }">
          <div
            v-bind="activatorProps"
            class="bar-hit"
            tabindex="0"
            :aria-label="`${bar.fullLabel}: ${bar.goals} gols`"
            :style="{ left: `${index * slot}px`, width: `${slot}px`, top: `${TOP}px`, height: `${BASE - TOP}px` }"
            data-test="goals-bar"
            @mouseenter="activeIndex = index"
            @mouseleave="activeIndex = null"
            @focus="activeIndex = index"
            @blur="activeIndex = null"
          />
        </template>
        <strong>{{ bar.goals }} {{ bar.goals === 1 ? 'gol' : 'gols' }}</strong>
        <span class="ml-1">· {{ bar.fullLabel }}</span>
      </v-tooltip>
    </div>

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
}
.chart-canvas {
  position: relative;
}
.bar-hit {
  position: absolute;
  cursor: pointer;
  outline: none;
}
.bar-hit:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  border-radius: 4px;
}
.bar-mark {
  transition: opacity 0.12s;
}
.bar-mark.is-active {
  opacity: 0.75;
}
.bar-value {
  font-size: 12px;
  font-weight: 700;
  fill: rgb(var(--v-theme-on-surface));
  font-variant-numeric: tabular-nums;
}
.bar-label {
  font-size: 11px;
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
