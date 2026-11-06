import { computed } from 'vue'
import { useTheme } from 'vuetify'

const LIGHT = {
  series1: '#2a78d6',
  series2: '#eb6834',
  series3: '#1baf7a',
  yellowCard: '#eda100',
  redCard: '#e34948',
  baseline: '#c3c2b7',
}

const DARK: typeof LIGHT = {
  series1: '#3987e5',
  series2: '#d95926',
  series3: '#199e70',
  yellowCard: '#c98500',
  redCard: '#d03b3b',
  baseline: '#383835',
}

export function useChartPalette() {
  const theme = useTheme()
  return computed(() => (theme.current.value.dark ? DARK : LIGHT))
}
