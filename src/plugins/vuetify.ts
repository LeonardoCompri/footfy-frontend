import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'footfyLight',
    themes: {
      footfyLight: {
        dark: false,
        colors: {
          primary: '#1B5E20',
          secondary: '#FFB300',
          background: '#F5F5F5',
        },
      },
    },
  },
})
