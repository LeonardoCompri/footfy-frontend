import { pt } from 'vuetify/locale'

// Separado do plugin (sem imports de CSS) para os testes usarem os mesmos textos do app.
export const vuetifyLocale = {
  locale: 'pt',
  fallback: 'en',
  messages: { pt },
}
