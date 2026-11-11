<script setup lang="ts">
import { computed } from 'vue'
import { maskCpf, rosterSheet } from './scoresheet'
import type { ScoresheetData } from './scoresheet'

const props = defineProps<{ data: ScoresheetData; sheet: number }>()

const teams = computed(() =>
  (['home', 'away'] as const).map((side) => ({
    side,
    badge: side === 'home' ? 'M' : 'V',
    word: side === 'home' ? 'Mandante' : 'Visitante',
    team: props.data[side],
    rows: rosterSheet(props.data[side].roster, props.sheet, props.data.rosterRows),
  })),
)
</script>

<template>
  <template v-if="sheet === 0">
    <section class="match" data-test="scoresheet-match">
      <div class="club">
        <span class="crest">
          <img v-if="data.home.logo" :src="data.home.logo" alt="" />
          <template v-else>{{ data.home.initials }}</template>
        </span>
        <div>
          <div class="club-name">{{ data.home.name }}</div>
          <div class="club-side"><span class="side-badge">M</span>Mandante</div>
        </div>
      </div>
      <div class="score">
        <div class="score-label">Placar final · tempo normal</div>
        <div class="score-boxes">
          <span class="score-box" data-test="scoresheet-score-home">{{ data.home.score }}</span>
          <span class="score-x">×</span>
          <span class="score-box" data-test="scoresheet-score-away">{{ data.away.score }}</span>
        </div>
        <div
          v-if="data.penaltiesScore"
          class="score-note penalties"
          data-test="scoresheet-penalties-score"
        >
          Pênaltis: {{ data.penaltiesScore }}
        </div>
        <div v-else-if="data.penalties && !data.filled" class="score-note">
          Terminou empatado? Preencha a disputa de pênaltis na pág. {{ data.penaltiesPage }}
        </div>
      </div>
      <div class="club away">
        <div>
          <div class="club-name">{{ data.away.name }}</div>
          <div class="club-side">Visitante<span class="side-badge">V</span></div>
        </div>
        <span class="crest">
          <img v-if="data.away.logo" :src="data.away.logo" alt="" />
          <template v-else>{{ data.away.initials }}</template>
        </span>
      </div>
    </section>
    <section class="cards" data-test="scoresheet-cards">
      <div class="card">
        <span class="label">Competição</span>
        <span class="value" data-test="scoresheet-competition">{{
          data.competition.join(' · ')
        }}</span>
      </div>
      <div class="card" :class="{ fill: !data.stage }">
        <span class="label">{{ data.stageLabel }}</span>
        <span v-if="data.stage" class="value">{{ data.stage }}</span>
        <span v-else class="write-line" />
      </div>
      <div class="card" :class="{ fill: !data.place }">
        <span class="label">Local</span>
        <span v-if="data.place" class="value">{{ data.place }}</span>
        <span v-else class="write-line" />
      </div>
      <div class="card" :class="{ fill: !data.date }">
        <span class="label">Data e horário</span>
        <span v-if="data.date" class="value">{{ data.date }}</span>
        <span v-else class="write-line" />
      </div>
      <div class="card fill">
        <span class="label">Árbitro principal</span>
        <span class="write-line" />
      </div>
    </section>
  </template>
  <div v-else class="matchline">
    {{ data.home.name }} <i>×</i> {{ data.away.name }}
    <template v-if="data.matchline">· {{ data.matchline }}</template>
  </div>

  <section class="teams" :style="{ '--roster-rows': data.rosterRows }">
    <div
      v-for="item in teams"
      :key="item.side"
      class="team"
      :data-test="`scoresheet-roster-${item.side}`"
    >
      <div class="team-bar">
        <span class="side-badge">{{ item.badge }}</span>
        <strong>{{ item.team.name }}</strong>
        <span class="side-word">{{ item.word }}</span>
        <span v-if="item.team.coach" class="coach" data-test="scoresheet-coach">
          Téc. {{ item.team.coach }}
        </span>
      </div>
      <table class="roster">
        <colgroup>
          <col style="width: 7mm" />
          <col />
          <col style="width: 24mm" />
          <col style="width: 35mm" />
        </colgroup>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Nome do atleta</th>
            <th>CPF</th>
            <th>Assinatura</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(player, index) in item.rows"
            :key="player?.id ?? `blank-${index}`"
            :class="{ blank: !player }"
            :data-test="player ? 'scoresheet-player' : 'scoresheet-blank'"
          >
            <td class="num">{{ player?.number ?? '' }}</td>
            <td>{{ player?.name ?? '' }}</td>
            <td class="cpf">{{ maskCpf(player?.document) }}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  <p class="hint" data-test="scoresheet-roster-hint">
    <template v-if="data.filled">Relação conforme o cadastro atual do time</template>
    <template v-else>
      Linhas em branco: atletas fora da relação impressa. Cadastre-os no Futy antes de digitar os
      eventos.
    </template>
  </p>
</template>
