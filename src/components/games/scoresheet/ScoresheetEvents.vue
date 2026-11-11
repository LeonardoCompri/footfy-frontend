<script setup lang="ts">
import { computed } from 'vue'
import { EVENT_ROWS, eventSheet, eventTypeAbbreviation } from './scoresheet'
import type { ScoresheetData } from './scoresheet'
import type { EventTypeMeta } from '@/types/gameEvent'

const props = defineProps<{
  data: ScoresheetData
  eventTypes: EventTypeMeta[]
  sheet: number
}>()

const types = computed(() =>
  props.eventTypes.map((type) => ({
    slug: type.slug,
    name: type.name,
    abbreviation: eventTypeAbbreviation(type),
  })),
)
const typeColumnWidth = computed(() => `${Math.max(4, types.value.length) * 10.5}mm`)
const rows = computed(() => eventSheet(props.data.events, props.sheet))
</script>

<template>
  <div class="matchline">
    {{ data.home.name }} <i>×</i> {{ data.away.name }}
    <template v-if="data.matchline">· {{ data.matchline }}</template>
  </div>
  <section class="legend" data-test="scoresheet-legend">
    <span class="legend-title">{{ data.filled ? 'Legenda' : 'Marque com X' }}</span>
    <span class="key-group">
      <b>Tipo</b>
      <span v-for="type in types" :key="type.slug" class="key" data-test="scoresheet-legend-type">
        <b>{{ type.abbreviation }}</b> {{ type.name }}
      </span>
    </span>
    <span class="key-group">
      <b>Equipe</b>
      <span class="key"><b>M</b> Mandante</span>
      <span class="key"><b>V</b> Visitante</span>
    </span>
    <span class="key-group">
      <span><b>Min.</b> corrido (2º T: 46, 47…) · <b>Assist.</b> nº, só gol</span>
    </span>
  </section>
  <table class="events" data-test="scoresheet-events">
    <colgroup>
      <col style="width: 6mm" />
      <col style="width: 12mm" />
      <col :style="{ width: typeColumnWidth }" />
      <col style="width: 17mm" />
      <col style="width: 11mm" />
      <col style="width: 60mm" />
      <col style="width: 14mm" />
      <col />
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Min.</th>
        <th>Tipo de evento</th>
        <th>Equipe</th>
        <th>Nº</th>
        <th>Atleta</th>
        <th>Assist.</th>
        <th>Observação</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.index" data-test="scoresheet-event-row">
        <td class="idx">{{ row.index }}</td>
        <td class="c">{{ row.event?.minute }}</td>
        <td>
          <span v-for="type in types" :key="type.slug" class="opt">
            <span class="cb" :class="{ on: row.event?.type === type.slug }" />{{
              type.abbreviation
            }}
          </span>
        </td>
        <td>
          <span class="opt"><span class="cb" :class="{ on: row.event?.side === 'home' }" />M</span>
          <span class="opt"><span class="cb" :class="{ on: row.event?.side === 'away' }" />V</span>
        </td>
        <td class="c">{{ row.event?.number }}</td>
        <td class="text">{{ row.event?.athlete }}</td>
        <td class="c">{{ row.event?.assistNumber }}</td>
        <td class="text">{{ row.event?.observation }}</td>
      </tr>
    </tbody>
  </table>
  <p v-if="!data.filled" class="hint">
    Mais eventos do que linhas? Use uma folha extra desta página e numere a partir do
    {{ EVENT_ROWS + 1 }}.
  </p>
  <section class="bottom" :class="{ single: data.filled }">
    <div class="box">
      <div class="box-title">Relatório de ocorrências / incidentes</div>
      <div class="ruled"><span /><span /><span /></div>
    </div>
    <div v-if="!data.filled" class="box office">
      <div class="box-title">Uso do escritório · conferência da digitação</div>
      <div class="checks">
        <span class="opt"><span class="cb" />Atletas conferidos</span>
        <span class="opt"><span class="cb" />Placar do sistema confere</span>
        <span class="opt"><span class="cb" />Eventos digitados</span>
        <span v-if="data.penalties" class="opt"><span class="cb" />Cobranças de pênalti</span>
      </div>
      <div class="office-line">
        <span>Digitado por</span>
        <span class="write-line" />
        <span>Data</span>
        <span class="date-boxes">__/__/____</span>
      </div>
    </div>
  </section>
  <section class="signs">
    <div class="sign">
      <span class="sign-line" />
      <span class="sign-label">Árbitro principal</span>
    </div>
    <div class="sign">
      <span class="sign-line" />
      <span class="sign-label">Capitão · {{ data.home.name }}</span>
    </div>
    <div class="sign">
      <span class="sign-line" />
      <span class="sign-label">Capitão · {{ data.away.name }}</span>
    </div>
  </section>
</template>
