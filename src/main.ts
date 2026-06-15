import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@/assets/styles/main.css'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())

useAuthStore().restoreSession()

app.use(router)
app.use(vuetify)

app.mount('#app')
