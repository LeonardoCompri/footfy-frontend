import { ref, type Ref } from 'vue'

export function useConfirmDialog<T>() {
  const open = ref(false)
  const target = ref(null) as Ref<T | null>

  function ask(item: T) {
    target.value = item
    open.value = true
  }

  return { open, target, ask }
}
