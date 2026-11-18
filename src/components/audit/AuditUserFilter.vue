<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { usersService } from '@/services/api/users.service'
import type { User } from '@/types/user'

const SEARCH_DEBOUNCE_MS = 300
const PER_PAGE = 20

const props = defineProps<{
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const results = ref<User[]>([])
const selected = ref<User | null>(null)
const loading = ref(false)
const loaded = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let requestId = 0

const items = computed(() =>
  selected.value
    ? [selected.value, ...results.value.filter((user) => user.id !== selected.value?.id)]
    : results.value,
)

async function load(search: string) {
  const current = ++requestId
  loading.value = true
  try {
    const users = await usersService.list({
      search: search || undefined,
      page: 1,
      per_page: PER_PAGE,
    })
    if (current !== requestId) return
    results.value = users
    loaded.value = true
  } catch {
    if (current === requestId) results.value = []
  } finally {
    if (current === requestId) loading.value = false
  }
}

function onSearch(term: string | null) {
  const search = (term ?? '').trim()
  if (selected.value && search === selected.value.name) return
  clearTimeout(timer)
  timer = setTimeout(() => load(search), SEARCH_DEBOUNCE_MS)
}

function onMenu(open: boolean) {
  if (open && !loaded.value) load('')
}

function onSelect(id: number | null) {
  selected.value = items.value.find((user) => user.id === id) ?? null
  emit('update:modelValue', id)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <v-autocomplete
    :model-value="props.modelValue"
    :items="items"
    item-title="name"
    item-value="id"
    label="Usuário"
    :loading="loading"
    no-filter
    hide-details
    clearable
    no-data-text="Nenhum usuário encontrado."
    @update:model-value="onSelect"
    @update:search="onSearch"
    @update:menu="onMenu"
  />
</template>
