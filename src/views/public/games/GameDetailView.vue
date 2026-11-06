<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{ id: string }>()

const router = useRouter()

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
