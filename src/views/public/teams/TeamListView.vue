<script setup lang="ts">
import { onMounted } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { teamsService } from '@/services/api/teams.service'
import type { Team, TeamPayload } from '@/types/team'
import TeamCard from '@/components/teams/TeamCard.vue'

const { items, loading, errorMessage, fetchAll } = useCrud<Team, TeamPayload>(teamsService)

onMounted(fetchAll)
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 font-weight-bold mb-6">Times</h1>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-row v-if="loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="items.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">Nenhum time cadastrado ainda.</v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col v-for="team in items" :key="team.id" cols="12" sm="6" md="4">
        <TeamCard :team="team" />
      </v-col>
    </v-row>
  </v-container>
</template>
