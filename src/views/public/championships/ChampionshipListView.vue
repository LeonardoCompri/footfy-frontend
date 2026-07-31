<script setup lang="ts">
import { onMounted } from 'vue'
import { usePublicList } from '@/composables/usePublicList'
import { publicChampionshipsService } from '@/services/api/publicChampionships.service'
import type { Championship } from '@/types/championship'
import ChampionshipCard from '@/components/championships/ChampionshipCard.vue'

const { items, loading, errorMessage, fetchAll } = usePublicList<Championship>(
  publicChampionshipsService,
)

onMounted(fetchAll)
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 font-weight-bold mb-6">Campeonatos</h1>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-row v-if="loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="items.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">Nenhum campeonato cadastrado ainda.</v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col v-for="championship in items" :key="championship.id" cols="12" sm="6" md="4">
        <ChampionshipCard :championship="championship" />
      </v-col>
    </v-row>
  </v-container>
</template>
