<script setup lang="ts">
import { computed } from 'vue'
import type { Team } from '@/types/team'

const props = defineProps<{
  team: Team
  leagueId?: number | string
}>()

const to = computed(() => ({
  name: 'teams-detail',
  params: { id: props.team.id },
  query: props.leagueId ? { back: String(props.leagueId) } : undefined,
}))
</script>

<template>
  <v-card :to="to">
    <v-card-item>
      <v-card-title>{{ team.name }}</v-card-title>
      <v-card-subtitle v-if="team.nickname">{{ team.nickname }}</v-card-subtitle>
    </v-card-item>
    <v-card-text v-if="team.logo">
      <v-img :src="team.logo" height="120" contain />
    </v-card-text>
  </v-card>
</template>
