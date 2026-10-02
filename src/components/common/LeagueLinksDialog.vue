<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import type { League } from '@/types/championship'

// Lista de ligas com Vincular/Desvincular por linha (vínculo time↔liga e usuário↔liga).
// Só apresenta: quem usa faz as chamadas de API no evento `toggle`.
const props = defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
  leagues: League[]
  linkedIds: number[]
  loading?: boolean
  errorMessage?: string | null
  busyLeagueId?: number | null
  // Liga que não pode ser alterada daqui (ex.: a liga ativa no vínculo do time); vem primeiro.
  lockedLeagueId?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  toggle: [leagueId: number, linked: boolean]
}>()

const { xs } = useDisplay()

const rows = computed(() =>
  [...props.leagues].sort(
    (a, b) => Number(b.id === props.lockedLeagueId) - Number(a.id === props.lockedLeagueId),
  ),
)

function isLinked(leagueId: number): boolean {
  return props.linkedIds.includes(leagueId)
}

const busy = computed(() => props.busyLeagueId != null)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    :fullscreen="xs"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="text-truncate">{{ title }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-card-subtitle v-if="subtitle" class="text-wrap">{{ subtitle }}</v-card-subtitle>
      <v-card-text>
        <div v-if="loading" class="d-flex justify-center py-6">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>
        <v-list v-else lines="two" class="pa-0">
          <v-list-item
            v-for="league in rows"
            :key="league.id"
            :title="league.name"
            :subtitle="league.championship?.name"
            data-test="league-link-row"
          >
            <template #append>
              <v-chip v-if="league.id === lockedLeagueId" size="small" color="primary" variant="tonal">
                Liga atual
              </v-chip>
              <v-btn
                v-else
                size="small"
                :variant="isLinked(league.id) ? 'outlined' : 'flat'"
                :color="isLinked(league.id) ? 'error' : 'primary'"
                :loading="busyLeagueId === league.id"
                :disabled="busy && busyLeagueId !== league.id"
                data-test="league-link-toggle"
                @click="emit('toggle', league.id, isLinked(league.id))"
              >
                {{ isLinked(league.id) ? 'Desvincular' : 'Vincular' }}
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
