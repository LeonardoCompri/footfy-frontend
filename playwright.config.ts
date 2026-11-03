import { defineConfig, devices } from '@playwright/test'
import { API_BASE_URL, APP_PORT, APP_URL } from './e2e/support/env'

// Build de produção servido pelo `vite preview`: no dev server, dependências descobertas ao abrir
// uma rota lazy disparam re-otimização e reload da página no meio do teste.
const OUT_DIR = 'node_modules/.cache/e2e-dist'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: APP_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
  webServer: {
    command: `npx vite build --outDir ${OUT_DIR} --emptyOutDir && npx vite preview --outDir ${OUT_DIR} --port ${APP_PORT} --strictPort`,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    // Variável de ambiente tem prioridade sobre o .env no Vite.
    env: { VITE_API_BASE_URL: API_BASE_URL },
    timeout: 120_000,
  },
})
