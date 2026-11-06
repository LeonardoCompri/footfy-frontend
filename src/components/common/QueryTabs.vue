<script setup lang="ts">
import { useQueryTab } from '@/composables/useQueryTab'

const props = defineProps<{
  tabs: { value: string; title: string }[]
  defaultTab?: string
}>()

const { tab } = useQueryTab(props.defaultTab ?? props.tabs[0].value)
</script>

<template>
  <div>
    <v-tabs v-model="tab" color="primary" class="mb-4" show-arrows>
      <v-tab v-for="item in tabs" :key="item.value" :value="item.value" :data-test="`tab-${item.value}`">
        {{ item.title }}
      </v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item v-for="item in tabs" :key="item.value" :value="item.value">
        <slot :name="item.value" />
      </v-window-item>
    </v-window>
  </div>
</template>
