<script setup lang="ts">
import { useDisplay } from 'vuetify'

// No mobile o card fica mais compacto para caber 2 por linha.
const { xs } = useDisplay()

defineProps<{
  icon: string
  label: string
  value: number | string
  color?: string
}>()
</script>

<template>
  <v-card class="pa-sm-2">
    <v-card-text class="d-flex align-center ga-3 ga-sm-4">
      <v-avatar :color="color ?? 'primary'" variant="tonal" :size="xs ? 40 : 56" class="stat-card-icon">
        <v-icon :icon="icon" :size="xs ? 22 : 28" />
      </v-avatar>
      <div class="min-w-0">
        <div class="text-h5 font-weight-bold">{{ value }}</div>
        <div class="text-medium-emphasis text-truncate">{{ label }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
