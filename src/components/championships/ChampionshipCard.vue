<script setup lang="ts">
import type { Championship } from '@/types/championship'

defineProps<{
  championship: Championship
}>()
</script>

<template>
  <v-card :to="{ name: 'championships-detail', params: { id: championship.id } }">
    <v-img v-if="championship.image" :src="championship.image" height="160" cover />
    <v-sheet v-else height="160" color="grey-lighten-3" class="d-flex align-center justify-center">
      <v-avatar color="primary" variant="tonal" size="64">
        <v-icon icon="mdi-trophy-outline" size="32" />
      </v-avatar>
    </v-sheet>
    <v-card-item>
      <v-card-title>{{ championship.name }}</v-card-title>
    </v-card-item>
  </v-card>
</template>
