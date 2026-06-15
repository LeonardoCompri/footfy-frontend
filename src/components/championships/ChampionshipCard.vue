<script setup lang="ts">
import type { Championship } from '@/types/championship'

defineProps<{
  championship: Championship
}>()

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}
</script>

<template>
  <v-card :to="{ name: 'championships-detail', params: { id: championship.id } }">
    <v-card-item>
      <v-card-title>{{ championship.name }}</v-card-title>
      <v-card-subtitle v-if="championship.organizer">{{ championship.organizer }}</v-card-subtitle>
    </v-card-item>
    <v-card-text>
      <div class="text-body-2">
        <strong>Início:</strong> {{ formatDate(championship.start_date) }}
      </div>
      <div class="text-body-2">
        <strong>Término:</strong> {{ formatDate(championship.end_date) }}
      </div>
    </v-card-text>
  </v-card>
</template>
