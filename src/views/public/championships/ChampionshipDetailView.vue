<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { championshipsService } from '@/services/api/championships.service'
import type { Championship, ChampionshipPayload } from '@/types/championship'

const props = defineProps<{ id: string }>()

const { fetchOne, loading, errorMessage } = useCrud<Championship, ChampionshipPayload>(
  championshipsService,
)
const championship = ref<Championship | null>(null)

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

onMounted(async () => {
  championship.value = await fetchOne(props.id)
})
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

    <v-card v-else-if="championship">
      <v-card-item>
        <v-card-title class="text-h4">{{ championship.name }}</v-card-title>
        <v-card-subtitle v-if="championship.organizer">
          Organização: {{ championship.organizer }}
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <p><strong>Início:</strong> {{ formatDate(championship.start_date) }}</p>
        <p><strong>Término:</strong> {{ formatDate(championship.end_date) }}</p>
      </v-card-text>
    </v-card>
  </v-container>
</template>
