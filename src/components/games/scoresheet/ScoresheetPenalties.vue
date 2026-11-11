<script setup lang="ts">
import { computed } from 'vue'
import { MIN_KICK_COLUMNS } from './scoresheet'
import type { ScoresheetData } from './scoresheet'

const props = defineProps<{ data: ScoresheetData }>()

const REGULAR_KICKS = 5
const columns = computed(() =>
  Array.from({ length: props.data.shootout.columns }, (_, index) => ({
    number: index + 1,
    suddenDeath: index >= REGULAR_KICKS,
  })),
)
const teams = computed(() =>
  (['home', 'away'] as const).map((side) => ({
    side,
    badge: side === 'home' ? 'M' : 'V',
    name: props.data[side].name,
    first: props.data.shootout[side].first,
    goals: props.data.shootout[side].goals,
    kicks: columns.value.map((column) => ({
      ...column,
      kick: props.data.shootout[side].kicks[column.number - 1] ?? null,
    })),
  })),
)
const stage = computed(() => [props.data.stage, 'desempate: pênaltis'].filter(Boolean).join(' · '))
</script>

<template>
  <div class="matchline">
    {{ data.home.name }} <i>×</i> {{ data.away.name }}
    <template v-if="data.matchline">· {{ data.matchline }}</template>
  </div>
  <section class="ko-info">
    <div v-if="data.filled" class="ko-when">{{ stage }}</div>
    <div v-else class="ko-when">
      <b>Quando preencher:</b> somente se o confronto terminar empatado e o regulamento prever
      pênaltis ({{ stage }}).
    </div>
    <div class="ko-regular">
      <span class="label">Placar do tempo normal</span>
      <span class="score-mini">
        <span class="sbox">{{ data.home.score }}</span
        >×<span class="sbox">{{ data.away.score }}</span>
      </span>
    </div>
  </section>
  <section class="legend">
    <span class="legend-title">{{ data.filled ? 'Legenda' : 'Como marcar' }}</span>
    <span class="key-group">
      <span class="legend-mark">
        <svg class="mark" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.6" class="ring" />
          <circle cx="10.3" cy="9.7" r="6.4" class="fill" />
        </svg>
      </span>
      <span><b>Convertido</b><template v-if="!data.filled">: pinte o círculo</template></span>
    </span>
    <span class="key-group">
      <span class="legend-mark">
        <svg class="mark" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.6" class="ring" />
          <path d="M4.2 4.6 15.6 15.8M15.4 4.1 4.6 15.4" class="cross" />
        </svg>
      </span>
      <span><b>Perdido</b><template v-if="!data.filled">: risque com X</template></span>
    </span>
    <span class="key-group">
      <span class="legend-mark">
        <svg class="mark" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.6" class="ring" />
        </svg>
      </span>
      <span><b>Não cobrou</b><template v-if="!data.filled">: deixe em branco</template></span>
    </span>
    <span class="key-group">
      <span>
        <b>Nº</b>: camisa do cobrador<template v-if="!data.filled">
          · marque quem bateu primeiro</template
        >
      </span>
    </span>
  </section>
  <table
    class="kicks"
    :class="{ compact: columns.length > MIN_KICK_COLUMNS }"
    :style="{ '--kick-columns': columns.length }"
    data-test="scoresheet-kicks"
  >
    <colgroup>
      <col style="width: 52mm" />
      <col v-for="column in columns" :key="column.number" />
      <col style="width: 22mm" />
    </colgroup>
    <thead>
      <tr class="groups">
        <th />
        <th :colspan="REGULAR_KICKS">Cobranças regulamentares</th>
        <th :colspan="columns.length - REGULAR_KICKS" class="sd">Alternadas · morte súbita</th>
        <th>Total</th>
      </tr>
      <tr class="nums">
        <th />
        <th v-for="column in columns" :key="column.number" :class="{ sd: column.suddenDeath }">
          {{ column.number }}
        </th>
        <th>Gols</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="team in teams" :key="team.side" :data-test="`scoresheet-kicks-${team.side}`">
        <th class="kteam">
          <div class="kteam-name">
            <span class="side-badge">{{ team.badge }}</span
            >{{ team.name }}
          </div>
          <span class="opt"><span class="cb" :class="{ on: team.first }" />Bateu primeiro</span>
        </th>
        <td
          v-for="cell in team.kicks"
          :key="cell.number"
          class="kick"
          :class="{ sd: cell.suddenDeath }"
          data-test="scoresheet-kick"
        >
          <div class="kick-num">
            <small>Nº</small><span class="kick-line">{{ cell.kick?.label }}</span>
          </div>
          <svg class="mark" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7.6" class="ring" />
            <circle v-if="cell.kick?.scored" cx="10.3" cy="9.7" r="6.4" class="fill" />
            <path v-else-if="cell.kick" d="M4.2 4.6 15.6 15.8M15.4 4.1 4.6 15.4" class="cross" />
          </svg>
        </td>
        <td class="ktotal">
          <span class="total-box">{{ team.goals }}</span>
        </td>
      </tr>
    </tbody>
  </table>
  <section class="ko-result">
    <div class="box">
      <div class="box-title">Resultado da disputa</div>
      <div class="result-line">
        <span class="result-team">{{ data.home.name }}</span>
        <span class="sbox lg" data-test="scoresheet-shootout-home">{{
          data.shootout.home.goals
        }}</span>
        <span class="score-x">×</span>
        <span class="sbox lg" data-test="scoresheet-shootout-away">{{
          data.shootout.away.goals
        }}</span>
        <span class="result-team">{{ data.away.name }}</span>
      </div>
    </div>
    <div class="box">
      <div class="box-title">Vencedor</div>
      <div class="winner">
        <span class="opt" data-test="scoresheet-winner-home"
          ><span class="cb" :class="{ on: data.shootout.home.won }" />{{ data.home.name }}</span
        >
        <span class="opt" data-test="scoresheet-winner-away"
          ><span class="cb" :class="{ on: data.shootout.away.won }" />{{ data.away.name }}</span
        >
      </div>
      <div v-if="!data.filled" class="office-mini">
        <span class="opt"><span class="cb" />Escritório: cobranças digitadas no Futy</span>
      </div>
    </div>
    <div class="box">
      <div class="box-title">Observações da disputa</div>
      <div class="ruled"><span /><span /><span /></div>
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
