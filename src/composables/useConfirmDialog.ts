import { ref, type Ref } from 'vue'

/**
 * Estado do ConfirmDialog de exclusão: guarda o item alvo enquanto o dialog está aberto.
 * Uso: `ask(item)` abre o dialog; no `@confirm`, `target.value` é o item a excluir.
 */
export function useConfirmDialog<T>() {
  const open = ref(false)
  const target = ref(null) as Ref<T | null>

  function ask(item: T) {
    target.value = item
    open.value = true
  }

  return { open, target, ask }
}
