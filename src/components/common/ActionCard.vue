<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'

const { lgAndUp } = useDisplay()
const stacked = computed(() => !lgAndUp.value)

const props = defineProps<{
  icon: string
  label: string
  color?: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ click: [] }>()

function handleClick() {
  if (props.disabled || props.loading) return
  emit('click')
}
</script>

<template>
  <v-card
    tag="button"
    type="button"
    class="action-card w-100 h-100 pa-sm-2"
    :loading="loading"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    @click="handleClick"
  >
    <v-card-text
      :class="[
        'd-flex align-center',
        stacked ? 'flex-column justify-center text-center ga-2 pa-3' : 'text-start ga-4',
      ]"
    >
      <v-avatar :color="color ?? 'primary'" variant="tonal" :size="stacked ? 40 : 56">
        <v-icon :icon="icon" :size="stacked ? 22 : 28" />
      </v-avatar>
      <span class="action-card__label font-weight-medium">{{ label }}</span>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.action-card__label {
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: anywhere;
}
</style>
