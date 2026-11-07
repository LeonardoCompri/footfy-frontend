<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_TIEBREAKERS, TIEBREAKER_LABELS, type Tiebreaker } from '@/types/leagueRules'
import {
  addTiebreaker,
  availableTiebreakers,
  moveTiebreaker,
  removeTiebreaker,
  sameTiebreakers,
} from './leagueRules'

const props = defineProps<{
  modelValue: Tiebreaker[]
  errorMessages?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Tiebreaker[]]
}>()

const options = computed(() =>
  availableTiebreakers(props.modelValue).map((value) => ({
    value,
    title: TIEBREAKER_LABELS[value],
  })),
)
const isDefault = computed(() => sameTiebreakers(props.modelValue, DEFAULT_TIEBREAKERS))

function update(list: Tiebreaker[]) {
  emit('update:modelValue', list)
}

function add(value: Tiebreaker | null) {
  if (value) update(addTiebreaker(props.modelValue, value))
}
</script>

<template>
  <div data-test="tiebreakers">
    <div class="d-flex flex-wrap align-center ga-2 mb-2">
      <span class="text-subtitle-1 font-weight-medium">Critérios de desempate</span>
      <v-chip v-if="isDefault" size="small" variant="tonal" data-test="tiebreakers-default">
        Padrão
      </v-chip>
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-restore"
        class="text-none"
        :disabled="isDefault"
        data-test="tiebreakers-restore"
        @click="update([...DEFAULT_TIEBREAKERS])"
      >
        Restaurar padrão
      </v-btn>
    </div>

    <v-list density="compact" border rounded="lg" class="py-0" aria-label="Critérios de desempate">
      <v-list-item v-for="(item, index) in modelValue" :key="item" data-test="tiebreaker-item">
        <v-list-item-title class="text-wrap">{{ TIEBREAKER_LABELS[item] }}</v-list-item-title>
        <template #prepend>
          <span class="text-medium-emphasis mr-3">{{ index + 1 }}º</span>
        </template>
        <template #append>
          <v-icon
            v-if="index === 0"
            icon="mdi-lock-outline"
            size="small"
            class="text-medium-emphasis mr-2"
            aria-label="Critério fixo"
          />
          <div v-else class="d-flex">
            <v-btn
              icon="mdi-arrow-up"
              variant="text"
              size="small"
              :disabled="index === 1"
              :aria-label="`Subir ${TIEBREAKER_LABELS[item]}`"
              data-test="tiebreaker-up"
              @click="update(moveTiebreaker(modelValue, index, -1))"
            />
            <v-btn
              icon="mdi-arrow-down"
              variant="text"
              size="small"
              :disabled="index === modelValue.length - 1"
              :aria-label="`Descer ${TIEBREAKER_LABELS[item]}`"
              data-test="tiebreaker-down"
              @click="update(moveTiebreaker(modelValue, index, 1))"
            />
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              :aria-label="`Remover ${TIEBREAKER_LABELS[item]}`"
              data-test="tiebreaker-remove"
              @click="update(removeTiebreaker(modelValue, index))"
            />
          </div>
        </template>
      </v-list-item>
    </v-list>

    <div
      v-if="errorMessages?.length"
      class="text-caption text-error mt-1"
      data-test="tiebreakers-error"
    >
      {{ errorMessages[0] }}
    </div>

    <v-select
      v-if="options.length"
      :model-value="null"
      :items="options"
      label="Incluir critério"
      prepend-inner-icon="mdi-plus"
      hide-details
      class="mt-3"
      data-test="tiebreaker-add"
      @update:model-value="add"
    />
  </div>
</template>
