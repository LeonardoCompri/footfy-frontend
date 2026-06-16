<script setup lang="ts">
import type { Team } from '@/types/team'

defineProps<{
  team: Team
}>()
</script>

<template>
  <v-card :to="{ name: 'teams-detail', params: { id: team.id } }">
    <v-card-item>
      <v-card-title>{{ team.name }}</v-card-title>
      <v-card-subtitle v-if="team.nickname">{{ team.nickname }}</v-card-subtitle>
    </v-card-item>
    <v-card-text v-if="team.logo">
      <v-img :src="team.logo" height="120" contain />
    </v-card-text>
  </v-card>
</template>
