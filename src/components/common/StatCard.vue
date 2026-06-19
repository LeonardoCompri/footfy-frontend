<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  value: number | string
  color?: string
}>()
</script>

<template>
  <v-card class="pa-2">
    <v-card-text class="d-flex align-center ga-4">
      <v-avatar :color="color ?? 'primary'" variant="tonal" size="56" class="stat-card-icon">
        <v-icon :icon="icon" size="28" />
      </v-avatar>
      <div>
        <div class="text-h5 font-weight-bold">{{ value }}</div>
        <div class="text-medium-emphasis">{{ label }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>
