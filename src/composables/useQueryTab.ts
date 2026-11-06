import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useQueryTab(defaultTab: string, param = 'tab') {
  const route = useRoute()
  const router = useRouter()

  const tab = computed({
    get: () => (typeof route.query[param] === 'string' ? (route.query[param] as string) : defaultTab),
    set: (value: string) => {
      router.replace({ query: { ...route.query, [param]: value } })
    },
  })

  return { tab }
}
