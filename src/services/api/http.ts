import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      const currentRoute = router.currentRoute.value
      authStore.clearSession()
      if (currentRoute.meta.requiresAuth) {
        router.push({ name: 'login', query: { redirect: currentRoute.fullPath } })
      }
    }
    return Promise.reject(error)
  },
)

export default http
