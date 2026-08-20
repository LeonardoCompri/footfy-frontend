<script setup lang="ts">
defineProps<{
  items: { label: string; value: number | string }[]
}>()
</script>

<template>
  <v-row>
    <v-col v-for="item in items" :key="item.label" cols="6" sm="4" md="3">
      <v-card variant="tonal" class="text-center pa-3">
        <div class="text-h5 font-weight-bold">{{ item.value }}</div>
        <div class="text-caption text-medium-emphasis">{{ item.label }}</div>
      </v-card>
    </v-col>
  </v-row>
</template>
