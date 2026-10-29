import { test as base, expect, type Page } from '@playwright/test'
import { registerDefaultRoutes } from './default-routes'
import { fixture, MockApi } from './mock-api'

export { expect }

export const DESKTOP = { width: 1366, height: 768 }
export const MOBILE = { width: 400, height: 860 }

/**
 * `api` (automático em todo teste): instala a API mockada e falha o teste, no fim, se houver
 * erro no console (`console.error`/`pageerror`), chamada à API sem mock ou requisição para fora.
 */
export const test = base.extend<{ api: MockApi }>({
  api: [
    async ({ page }, use) => {
      const api = new MockApi()
      registerDefaultRoutes(api)

      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
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
  // Liga ativa salva (como depois de entrar numa liga); null = sem liga ativa.
  leagueId?: number | null
  theme?: 'light' | 'dark'
}

/**
 * Sessão mockada: grava no localStorage o que o auth store e o contexto de liga leem ao subir
 * (mesmo formato do POST /login), sem passar pela tela de login.
 */
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

/** Diálogo do Vuetify aberto (o conteúdo de um diálogo fechado continua no DOM). */
export function openDialog(page: Page) {
  return page.locator('.v-dialog.v-overlay--active')
}
