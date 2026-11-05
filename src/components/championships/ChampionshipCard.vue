<script setup lang="ts">
import type { Championship } from '@/types/championship'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'

defineProps<{
  championship: Championship
}>()
</script>

<template>
  <v-card :to="{ name: 'championships-detail', params: { id: championship.id } }">
    <ChampionshipImage :src="championship.image" height="160">
      <v-sheet height="160" color="grey-lighten-3" class="d-flex align-center justify-center">
        <v-avatar color="primary" variant="tonal" size="64">
          <v-icon icon="mdi-trophy-outline" size="32" />
        </v-avatar>
      </v-sheet>
    </ChampionshipImage>
    <v-card-item>
      <v-card-title>{{ championship.name }}</v-card-title>
    </v-card-item>
  </v-card>
</template>
