<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <div>
      <h1 class="text-h4 font-weight-bold">{{ title }}</h1>
      <p v-if="subtitle" class="text-medium-emphasis mt-1">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </div>
</template>
