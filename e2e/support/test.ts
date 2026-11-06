import { test as base, expect, type Page } from '@playwright/test'
import { registerDefaultRoutes } from './default-routes'
import { fixture, MockApi } from './mock-api'

export { expect }

export const DESKTOP = { width: 1366, height: 768 }
export const MOBILE = { width: 400, height: 860 }

export const test = base.extend<{ api: MockApi }>({
  api: [
    async ({ page }, use) => {
      const api = new MockApi()
      registerDefaultRoutes(api)

      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        if (api.allowedConsoleErrors.some((pattern) => pattern.test(message.text()))) return
        errors.push(`console.error: ${message.text()}`)
      })
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

      await api.install(page)
      await use(api)

      expect(api.unexpected, 'Requisições para fora do app e da API mockada').toEqual([])
      expect(api.unmocked, 'Chamadas à API sem mock').toEqual([])
      expect(errors, 'Erros no console da página').toEqual([])
    },
    { auto: true },
  ],
})

export interface SessionOptions {
  role?: 'master' | 'admin'
  leagueId?: number | null
  theme?: 'light' | 'dark'
}

export async function signIn(page: Page, options: SessionOptions = {}) {
  const { role = 'master', leagueId = 1, theme = 'light' } = options
  await page.addInitScript(
    ({ auth, leagueId, theme }) => {
      localStorage.setItem('footfy_auth', JSON.stringify(auth))
      if (leagueId) localStorage.setItem('footfy_active_league', String(leagueId))
      else localStorage.removeItem('footfy_active_league')
      localStorage.setItem('footfy_admin_theme', theme === 'dark' ? 'footfyDark' : 'footfyLight')
    },
    { auth: fixture(`login-${role}`), leagueId, theme },
  )
}

export function openDialog(page: Page) {
  return page.locator('.v-dialog.v-overlay--active')
}
