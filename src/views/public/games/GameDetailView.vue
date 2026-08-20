<script setup lang="ts">
import { useRouter } from 'vue-router'

// TODO(FOOT-0024): implementar a tela completa da partida assim que a rota
// GET /public/games/{id} existir no backend. Por enquanto exibe apenas um placeholder.
defineProps<{ id: string }>()

const router = useRouter()
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="router.back()">
      Voltar
    </v-btn>

    <v-alert type="info" variant="tonal">
      Detalhes da partida em breve. Esta tela depende da rota pública de jogo (FOOT-0024).
    </v-alert>
  </v-container>
</template>
