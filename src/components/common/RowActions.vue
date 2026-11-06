<script setup lang="ts">
import { useDisplay } from 'vuetify'

export interface RowAction {
  key: string
  icon: string
  label: string
  color?: string
  dataTest: string
  onClick: () => void
}

defineProps<{
  actions: RowAction[]
  menuLabel: string
}>()

const { xs } = useDisplay()
</script>

<template>
  <div v-if="actions.length" class="d-flex justify-end">
    <v-menu v-if="xs && actions.length > 1" location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          :aria-label="menuLabel"
          data-test="row-actions-menu"
        />
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="action in actions"
          :key="action.key"
          :prepend-icon="action.icon"
          :title="action.label"
          :base-color="action.color"
          :data-test="action.dataTest"
          @click="action.onClick()"
        />
      </v-list>
    </v-menu>
    <template v-else>
      <v-btn
        v-for="action in actions"
        :key="action.key"
        :icon="action.icon"
        variant="text"
        size="small"
        :color="action.color"
        :aria-label="action.label"
        :data-test="action.dataTest"
        @click="action.onClick()"
      />
    </template>
  </div>
</template>
