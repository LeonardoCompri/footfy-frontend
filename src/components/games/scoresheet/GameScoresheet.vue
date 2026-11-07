<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import ScoresheetEvents from './ScoresheetEvents.vue'
import ScoresheetPenalties from './ScoresheetPenalties.vue'
import ScoresheetRoster from './ScoresheetRoster.vue'
import ScoresheetSheet from './ScoresheetSheet.vue'
import type { ScoresheetData } from './scoresheet'
import type { EventTypeMeta } from '@/types/gameEvent'
import './scoresheet.css'

const props = defineProps<{
  data: ScoresheetData
  eventTypes: EventTypeMeta[]
  generatedAt: string
}>()

const SHEET_WIDTH_PX = (297 * 96) / 25.4
const DESK_PADDING_PX = 32

const { width } = useDisplay()

const scale = computed(() => Math.min(1, (width.value - DESK_PADDING_PX) / SHEET_WIDTH_PX))
const rosterSheets = computed(() =>
  Array.from({ length: props.data.rosterSheets }, (_, index) => index),
)
const pages = computed(() => props.data.rosterSheets + 1 + (props.data.penalties ? 1 : 0))
const base = computed(() => ({
  pages: pages.value,
  code: props.data.code,
  competition: props.data.competition,
  generatedAt: props.generatedAt,
}))
</script>

<template>
  <main class="scoresheet" :style="{ '--sheet-scale': scale }" data-test="scoresheet">
    <slot />
    <ScoresheetSheet
      v-for="sheet in rosterSheets"
      :key="`roster-${sheet}`"
      v-bind="base"
      :page="sheet + 1"
      :subtitle="sheet === 0 ? 'Relação de atletas' : 'Relação de atletas (continuação)'"
      section="Relação de atletas"
    >
      <ScoresheetRoster :data="data" :sheet="sheet" />
    </ScoresheetSheet>
    <ScoresheetSheet
      v-bind="base"
      :page="data.rosterSheets + 1"
      subtitle="Registro de eventos e ocorrências"
      section="Registro de eventos"
    >
      <ScoresheetEvents :data="data" :event-types="eventTypes" />
    </ScoresheetSheet>
    <ScoresheetSheet
      v-if="data.penalties"
      v-bind="base"
      :page="data.rosterSheets + 2"
      subtitle="Disputa de pênaltis"
      section="Disputa de pênaltis"
      knockout
    >
      <ScoresheetPenalties :data="data" />
    </ScoresheetSheet>
  </main>
</template>
