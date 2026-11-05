<script setup lang="ts">
// Mostra a imagem inteira (contain) sobre uma cópia desfocada dela (cover), que preenche as
// sobras sem cortar nada. Sem `src`, renderiza o slot default (fallback de cada tela).
// O slot `overlay` fica por cima da imagem (ex.: botões da prévia no formulário).
defineProps<{
  src: string | null | undefined
  height?: number | string
  width?: number | string
  rounded?: string | boolean
}>()
</script>

<template>
  <v-img
    v-if="src"
    :src="src"
    :height="height"
    :width="width"
    :rounded="rounded"
    cover
    image-class="championship-image__backdrop"
    class="bg-surface-variant flex-grow-0"
  >
    <v-img :src="src" height="100%" data-test="championship-image-front">
      <slot name="overlay" />
    </v-img>
  </v-img>
  <slot v-else />
</template>

<style>
.championship-image__backdrop {
  filter: blur(16px);
  transform: scale(1.1);
}
</style>
