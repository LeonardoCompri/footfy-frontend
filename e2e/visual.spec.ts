import type { Page } from '@playwright/test'
import { DESKTOP, expect, MOBILE, signIn, test, type SessionOptions } from './support/test'

// Poucos snapshots de propósito (custam manutenção): dashboard e tabela da liga, desktop no tema
// claro e mobile no escuro. Atualize com `npm run test:e2e:update` quando a mudança visual for
// intencional e confira as imagens no diff antes de commitar.

const FIXED_NOW = new Date('2026-04-01T10:00:00-03:00')

async function openScreen(page: Page, path: string, ready: string, theme: SessionOptions['theme']) {
  await page.clock.setFixedTime(FIXED_NOW)
  await signIn(page, { theme })
  await page.goto(path)
  await expect(page.locator(ready).first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  // O logo do menu é <img>: sem esperar, a captura pode sair sem ele.
  await page.evaluate(() =>
    Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined))),
  )
}

const SCREENS = [
  { name: 'dashboard', path: '/admin/liga/1', ready: '[data-test=dashboard-counter]' },
  { name: 'tabela', path: '/admin/liga/1/tabela', ready: '[data-test=standings-row]' },
]

test.describe('Snapshots desktop, tema claro', () => {
  // Sem fullPage: o menu lateral é fixo com a altura da janela e sairia cortado na captura.
  test.use({ viewport: { width: DESKTOP.width, height: 1000 } })

  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await openScreen(page, screen.path, screen.ready, 'light')
      await expect(page).toHaveScreenshot(`${screen.name}-desktop-claro.png`)
    })
  }
})

test.describe('Snapshots mobile, tema escuro', () => {
  test.use({ viewport: MOBILE })

  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await openScreen(page, screen.path, screen.ready, 'dark')
      await expect(page).toHaveScreenshot(`${screen.name}-mobile-escuro.png`, { fullPage: true })
    })
  }
})
