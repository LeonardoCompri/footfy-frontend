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
          primary: '#1B6B2E',
          'primary-darken-1': '#134F22',
          'primary-lighten-1': '#3E8C53',
          secondary: '#C98A00',
          'secondary-darken-1': '#9C6B00',
          success: '#00897B',
          warning: '#FF8F00',
          error: '#D32F2F',
          info: '#0277BD',
          background: '#F4F6F3',
          surface: '#FFFFFF',
          'surface-variant': '#E9ECE7',
          'on-primary': '#FFFFFF',
          'on-secondary': '#1A1A1A',
          'on-success': '#FFFFFF',
          'on-warning': '#1A1A1A',
          'on-error': '#FFFFFF',
          'on-info': '#FFFFFF',
          'on-background': '#1A1C1A',
          'on-surface': '#1A1C1A',
          'on-surface-variant': '#44483F',
        },
      },
      footfyDark: {
        dark: true,
        colors: {
          primary: '#4CAF50',
          'primary-darken-1': '#2E7D32',
          secondary: '#FFC947',
          success: '#26A69A',
          warning: '#FFB74D',
          error: '#EF5350',
          info: '#4FC3F7',
          background: '#121412',
          surface: '#1B1D1B',
          'surface-variant': '#262924',
          'on-primary': '#0E2611',
          'on-secondary': '#2A1F00',
          'on-success': '#04231F',
          'on-warning': '#2A1700',
          'on-error': '#FFFFFF',
          'on-info': '#00131A',
          'on-background': '#E8EAE6',
          'on-surface': '#E8EAE6',
          'on-surface-variant': '#B8BDB3',
        },
      },
    },
  },
  defaults: {
    VBtn: {
      rounded: 'lg',
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
      border: true,
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VAutocomplete: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VDataTable: {
      density: 'comfortable',
      hover: true,
    },
    VNavigationDrawer: {
      elevation: 0,
      border: false,
    },
    VAppBar: {
      elevation: 0,
      border: true,
    },
    VChip: {
      rounded: 'lg',
    },
    VAlert: {
      rounded: 'lg',
      variant: 'tonal',
    },
  },
})
