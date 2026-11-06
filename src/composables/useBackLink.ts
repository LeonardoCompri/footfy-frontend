import { useRouter, type RouteLocationNamedRaw, type RouteLocationRaw } from 'vue-router'

export function useBackLink(fallback: RouteLocationNamedRaw): RouteLocationRaw {
  const router = useRouter()
  const back = router.options.history.state.back
  if (typeof back !== 'string') return fallback
  const previous = router.resolve(back)
  return previous.path === router.resolve(fallback).path ? previous.fullPath : fallback
}
