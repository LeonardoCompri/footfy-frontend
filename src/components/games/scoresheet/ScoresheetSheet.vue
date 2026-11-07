<script setup lang="ts">
import logo from '@/assets/brand/futy-verde-classico.svg'
import symbol from '@/assets/brand/futy-simbolo.svg'

defineProps<{
  page: number
  pages: number
  code: string
  competition: string[]
  subtitle: string
  section: string
  generatedAt: string
  knockout?: boolean
}>()
</script>

<template>
  <div class="frame">
    <article class="sheet" data-test="scoresheet-sheet">
      <img class="watermark" :src="symbol" alt="" aria-hidden="true" />
      <header class="head">
        <img class="logo" :src="logo" alt="Futy" />
        <div class="title">
          <div class="kicker" data-test="scoresheet-competition">
            <template v-for="(item, index) in competition" :key="index">
              <span v-if="index > 0">›</span>{{ item }}
            </template>
          </div>
          <h1>
            Súmula oficial de partida
            <span v-if="knockout" class="tag-ko" data-test="scoresheet-knockout-tag">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1 3h4v4h3M1 13h4V9h3M8 7v2M8 8h3.5M11.5 6v4h3.5" />
              </svg>
              Somente mata-mata
            </span>
          </h1>
          <div class="sub">Página {{ page }} · {{ subtitle }}</div>
        </div>
        <div class="meta">
          <div class="game-id" data-test="scoresheet-code"><small>Jogo</small>{{ code }}</div>
          <div class="page-chip" data-test="scoresheet-page">Pág. {{ page }} de {{ pages }}</div>
        </div>
      </header>

      <slot />

      <footer class="foot">
        <span class="foot-brand">
          <img class="foot-selo" :src="symbol" alt="" aria-hidden="true" />
          Futy · Súmula de partida · {{ section }}
        </span>
        <span>Gerado em {{ generatedAt }} · Jogo {{ code }} · Pág. {{ page }} de {{ pages }}</span>
      </footer>
    </article>
  </div>
</template>
