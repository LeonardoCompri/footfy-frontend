<script setup lang="ts">
import logo from '@/assets/brand/futy-verde-classico.svg'
import symbol from '@/assets/brand/futy-simbolo.svg'

defineProps<{
  page: number
  pages: number
  code: string
  subtitle: string
  section: string
  generatedAt: string
  filled?: boolean
}>()
</script>

<template>
  <div class="frame">
    <article class="sheet" data-test="scoresheet-sheet">
      <img class="watermark" :src="symbol" alt="" aria-hidden="true" />
      <header class="head">
        <img class="logo" :src="logo" alt="Futy" />
        <h1 data-test="scoresheet-title">Súmula oficial de partida - {{ subtitle }}</h1>
        <div class="game-id" data-test="scoresheet-code"><small>Jogo</small>{{ code }}</div>
      </header>

      <slot />

      <footer class="foot">
        <span class="foot-brand">
          <img class="foot-selo" :src="symbol" alt="" aria-hidden="true" />
          Futy · Súmula de partida · {{ section }}
        </span>
        <span>
          Gerado em {{ generatedAt
          }}<template v-if="filled"> a partir dos dados do Futy</template> · Jogo {{ code }} ·
          <span data-test="scoresheet-page">Pág. {{ page }} de {{ pages }}</span>
        </span>
      </footer>
    </article>
  </div>
</template>
