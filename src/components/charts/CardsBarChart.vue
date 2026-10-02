<script setup lang="ts">
import { computed } from 'vue'
import type { CardsSplit } from '@/types/dashboard'
import { useChartPalette } from './chartPalette'

const props = defineProps<{ cards: CardsSplit }>()

const palette = useChartPalette()

const rows = computed(() => {
  const max = Math.max(1, props.cards.yellow, props.cards.red)
  return [
    { key: 'yellow', label: 'Amarelos', value: props.cards.yellow, color: palette.value.yellowCard, icon: 'mdi-card' },
    { key: 'red', label: 'Vermelhos', value: props.cards.red, color: palette.value.redCard, icon: 'mdi-card' },
  ].map((row) => ({ ...row, width: (row.value / max) * 100 }))
})
</script>

<template>
  <div v-if="cards.yellow === 0 && cards.red === 0" class="text-medium-emphasis text-body-2 py-6 text-center">
    Nenhum cartão registrado nesta liga ainda.
  </div>
  <div v-else class="d-flex flex-column ga-3" data-test="cards-chart">
    <v-tooltip v-for="row in rows" :key="row.key" location="top">
      <template #activator="{ props: activatorProps }">
        <div v-bind="activatorProps" class="hbar-row" tabindex="0" data-test="cards-row">
          <span class="d-inline-flex align-center ga-1 text-body-2 text-medium-emphasis">
            <v-icon :icon="row.icon" :color="row.color" size="16" />
            {{ row.label }}
          </span>
          <div class="hbar-track">
            <div class="hbar-fill" :style="{ width: `${row.width}%`, background: row.color }" />
          </div>
          <strong class="text-right tabular">{{ row.value }}</strong>
        </div>
      </template>
      <strong>{{ row.value }}</strong> · Cartões {{ row.label.toLowerCase() }}
    </v-tooltip>
  </div>
</template>

<style scoped>
.hbar-row {
  display: grid;
  grid-template-columns: 110px 1fr 36px;
  align-items: center;
  gap: 12px;
  outline: none;
  cursor: pointer;
}
.hbar-track {
  height: 12px;
}
.hbar-fill {
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  transition: opacity 0.12s;
}
.hbar-row:hover .hbar-fill,
.hbar-row:focus-visible .hbar-fill {
  opacity: 0.75;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
