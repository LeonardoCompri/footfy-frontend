<script setup lang="ts">
import { computed } from 'vue'
import type { ScoresheetData } from './scoresheet'

const props = defineProps<{ data: ScoresheetData }>()

const REGULAR_KICKS = 5
const SUDDEN_DEATH_KICKS = 7
const kicks = Array.from({ length: REGULAR_KICKS + SUDDEN_DEATH_KICKS }, (_, index) => ({
  number: index + 1,
  suddenDeath: index >= REGULAR_KICKS,
}))
const teams = computed(() => [
  { side: 'home', badge: 'M', name: props.data.home.name },
  { side: 'away', badge: 'V', name: props.data.away.name },
])
const stage = computed(() => [props.data.stage, 'desempate: pênaltis'].filter(Boolean).join(' · '))
</script>

<template>
  <div class="matchline">
    {{ data.home.name }} <i>×</i> {{ data.away.name }}
    <template v-if="data.matchline">· {{ data.matchline }}</template>
  </div>
  <section class="ko-info">
    <div class="ko-when">
      <b>Quando preencher:</b> somente se o confronto terminar empatado e o regulamento prever
      pênaltis ({{ stage }}).
    </div>
    <div class="ko-regular">
      <span class="label">Placar do tempo normal</span>
      <span class="score-mini"><span class="sbox" />×<span class="sbox" /></span>
    </div>
  </section>
  <section class="legend">
    <span class="legend-title">Como marcar</span>
    <span class="key-group">
      <span class="legend-mark">
        <svg class="mark" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.6" class="ring" />
          <circle cx="10.3" cy="9.7" r="6.4" class="fill" />
        </svg>
      </span>
      <span><b>Convertido</b>: pinte o círculo</span>
    </span>
    <span class="key-group">
      <span class="legend-mark">
        <svg class="mark" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.6" class="ring" />
          <path d="M4.2 4.6 15.6 15.8M15.4 4.1 4.6 15.4" class="cross" />
        </svg>
      </span>
      <span><b>Perdido</b>: risque com X</span>
    </span>
    <span class="key-group">
      <span class="legend-mark">
        <svg class="mark" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.6" class="ring" />
        </svg>
      </span>
      <span><b>Não cobrou</b>: deixe em branco</span>
    </span>
    <span class="key-group">
      <span><b>Nº</b>: camisa do cobrador · marque quem bateu primeiro</span>
    </span>
  </section>
  <table class="kicks" data-test="scoresheet-kicks">
    <colgroup>
      <col style="width: 52mm" />
      <col v-for="kick in kicks" :key="kick.number" />
      <col style="width: 22mm" />
    </colgroup>
    <thead>
      <tr class="groups">
        <th />
        <th :colspan="REGULAR_KICKS">Cobranças regulamentares</th>
        <th :colspan="SUDDEN_DEATH_KICKS" class="sd">Alternadas · morte súbita</th>
        <th>Total</th>
      </tr>
      <tr class="nums">
        <th />
        <th v-for="kick in kicks" :key="kick.number" :class="{ sd: kick.suddenDeath }">
          {{ kick.number }}
        </th>
        <th>Gols</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="team in teams" :key="team.side">
        <th class="kteam">
          <div class="kteam-name">
            <span class="side-badge">{{ team.badge }}</span
            >{{ team.name }}
          </div>
          <span class="opt"><span class="cb" />Bateu primeiro</span>
        </th>
        <td
          v-for="kick in kicks"
          :key="kick.number"
          class="kick"
          :class="{ sd: kick.suddenDeath }"
          data-test="scoresheet-kick"
        >
          <div class="kick-num"><small>Nº</small><span class="kick-line" /></div>
          <svg class="mark" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7.6" class="ring" />
          </svg>
        </td>
        <td class="ktotal"><span class="total-box" /></td>
      </tr>
    </tbody>
  </table>
  <section class="ko-result">
    <div class="box">
      <div class="box-title">Resultado da disputa</div>
      <div class="result-line">
        <span class="result-team">{{ data.home.name }}</span>
        <span class="sbox lg" />
        <span class="score-x">×</span>
        <span class="sbox lg" />
        <span class="result-team">{{ data.away.name }}</span>
      </div>
    </div>
    <div class="box">
      <div class="box-title">Vencedor</div>
      <div class="winner">
        <span class="opt"><span class="cb" />{{ data.home.name }}</span>
        <span class="opt"><span class="cb" />{{ data.away.name }}</span>
      </div>
      <div class="office-mini">
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
