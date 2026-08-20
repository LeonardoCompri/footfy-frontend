<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePublicItem } from '@/composables/usePublicItem'
import { publicChampionshipsService } from '@/services/api/publicChampionships.service'
import type { Championship } from '@/types/championship'
import LeagueCard from '@/components/leagues/LeagueCard.vue'

const props = defineProps<{ id: string }>()

const {
  item: championship,
  loading,
  errorMessage,
  fetchOne,
} = usePublicItem<Championship>(publicChampionshipsService)

const leagues = computed(() => championship.value?.leagues ?? [])

onMounted(() => fetchOne(props.id))
</script>

<template>
  <v-container class="py-8">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-4"
      :to="{ name: 'championships-list' }"
    >
      Voltar
    </v-btn>

    <v-row v-if="loading" justify="center">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>

    <template v-else-if="championship">
      <v-card class="mb-6">
        <v-img v-if="championship.image" :src="championship.image" height="200" cover />
        <v-card-item>
          <v-card-title class="text-h4">{{ championship.name }}</v-card-title>
        </v-card-item>
      </v-card>

      <h2 class="text-h5 font-weight-bold mb-4">Ligas</h2>

      <v-alert v-if="leagues.length === 0" type="info" variant="tonal">
        Nenhuma liga cadastrada para este campeonato ainda.
      </v-alert>

      <v-row v-else>
        <v-col v-for="league in leagues" :key="league.id" cols="12" sm="6" md="4">
          <LeagueCard :league="league" />
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>
