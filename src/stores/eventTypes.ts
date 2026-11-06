import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { eventTypesService } from '@/services/api/eventTypes.service'
import type { EventTypeMeta } from '@/types/gameEvent'

const THEME_COLORS = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'card-yellow',
  'card-red',
  'grey',
]

export const UNKNOWN_EVENT_TYPE_ICON = 'mdi-help-circle-outline'

function normalize(type: EventTypeMeta): EventTypeMeta {
  return {
    ...type,
    color: THEME_COLORS.includes(type.color) ? type.color : 'primary',
    icon: /^mdi-[\w-]+$/.test(type.icon ?? '') ? type.icon : UNKNOWN_EVENT_TYPE_ICON,
  }
}

function unknownType(slug: string): EventTypeMeta {
  return {
    id: 0,
    slug,
    name: slug,
    icon: UNKNOWN_EVENT_TYPE_ICON,
    color: 'grey',
    counts_for: null,
    allows_assist: false,
    card: null,
    sort_order: 0,
    active: false,
  }
}

export const useEventTypesStore = defineStore('eventTypes', () => {
  const types = ref<EventTypeMeta[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  let pending: Promise<void> | null = null

  const bySlugMap = computed(() => new Map(types.value.map((type) => [type.slug, type])))
  const active = computed(() => types.value.filter((type) => type.active))

  function bySlug(slug: string): EventTypeMeta {
    return bySlugMap.value.get(slug) ?? unknownType(slug)
  }

  function load(): Promise<void> {
    if (loaded.value) return Promise.resolve()
    if (pending) return pending

    loading.value = true
    errorMessage.value = null
    pending = eventTypesService
      .list()
      .then((list) => {
        types.value = list.map(normalize).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        loaded.value = true
      })
      .catch((err) => {
        errorMessage.value = extractErrorMessage(err)
        throw err
      })
      .finally(() => {
        loading.value = false
        pending = null
      })
    return pending
  }

  return { types, loaded, loading, errorMessage, active, bySlug, load }
})
