<script setup lang="ts">
import { useRouter } from 'vue-router'

// TODO: implementar a tela completa da partida com GET /public/games/{id}, que já existe no
// backend. Por enquanto exibe apenas um placeholder.
defineProps<{ id: string }>()

const router = useRouter()

// Aberta direto (link compartilhado, nova aba, recarregar), não há página anterior no app:
// cai na lista pública de campeonatos em vez de sair do site.
function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    router.push({ name: 'championships-list' })
  }
}
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="goBack">
      Voltar
    </v-btn>

    <v-alert type="info" variant="tonal">Detalhes da partida em breve.</v-alert>
  </v-container>
</template>
