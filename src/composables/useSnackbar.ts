import { ref } from 'vue'

type SnackbarColor = 'success' | 'error' | 'info' | 'warning'

const visible = ref(false)
const message = ref('')
const color = ref<SnackbarColor>('success')

export function useSnackbar() {
  function show(text: string, snackColor: SnackbarColor = 'success') {
    message.value = text
    color.value = snackColor
    visible.value = true
  }

  function success(text: string) {
    show(text, 'success')
  }

  function error(text: string) {
    show(text, 'error')
  }

  return { visible, message, color, show, success, error }
}
