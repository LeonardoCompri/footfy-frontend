import { computed, ref } from 'vue'

const STORAGE_KEY = 'footfy_admin_theme'
const LIGHT_THEME = 'footfyLight'
const DARK_THEME = 'footfyDark'

function getInitialTheme(): typeof LIGHT_THEME | typeof DARK_THEME {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === LIGHT_THEME || stored === DARK_THEME) return stored

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? DARK_THEME : LIGHT_THEME
}

const themeName = ref(getInitialTheme())

export function useAppTheme() {
  const isDark = computed(() => themeName.value === DARK_THEME)

  function toggleTheme() {
    themeName.value = isDark.value ? LIGHT_THEME : DARK_THEME
    localStorage.setItem(STORAGE_KEY, themeName.value)
  }

  return { themeName, isDark, toggleTheme }
}
