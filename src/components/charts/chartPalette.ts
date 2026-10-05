import { computed } from 'vue'
import { useTheme } from 'vuetify'

/**
 * Paleta dos gráficos (Dashboard e Estatísticas, admin e público — paleta de referência da skill de dataviz), validada
 * com `validate_palette.js` contra as superfícies do tema (#FFFFFF claro / #1B1D1B escuro):
 * - série única e resultados: slots categóricos 1-3 (azul, laranja, aqua) — passam
 *   todos os pares (CVD ΔE >= 9.2, visão normal >= 26.5) nos dois modos;
 * - cartões: amarelo × vermelho — o modo escuro usa o vermelho `critical` (#d03b3b),
 *   porque o vermelho categórico escuro fica abaixo do piso de visão normal ao lado do
 *   amarelo escuro. Aqua/amarelo claros ficam abaixo de 3:1 de contraste, então esses
 *   gráficos sempre exibem os valores como rótulo visível (regra de alívio).
 */
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

// Segue o tema efetivo do VApp mais próximo (admin alterna claro/escuro; o público é claro).
export function useChartPalette() {
  const theme = useTheme()
  return computed(() => (theme.current.value.dark ? DARK : LIGHT))
}
