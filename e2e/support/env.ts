// Compartilhado entre o playwright.config.ts e os helpers dos testes.
export const APP_PORT = 4180
export const APP_URL = `http://localhost:${APP_PORT}`

// Host que não existe: o build do E2E aponta a API para cá e o mock intercepta tudo. Uma
// requisição que escapar do mock falha, em vez de cair num backend real.
export const API_BASE_URL = 'http://api.footfy.e2e/api'
