<script setup lang="ts">
import type { League } from '@/types/championship'

defineProps<{
  league: League
}>()
</script>

<template>
  <v-card :to="{ name: 'leagues-detail', params: { id: league.id } }">
    <v-card-item>
      <v-card-title>{{ league.name }}</v-card-title>
      <v-card-subtitle v-if="league.season">{{ league.season }}</v-card-subtitle>
    </v-card-item>
    <v-card-text v-if="league.organizer" class="text-medium-emphasis">
      {{ league.organizer }}
    </v-card-text>
  </v-card>
</template>
