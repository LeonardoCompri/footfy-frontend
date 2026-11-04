import { expect, test } from './support/test'

// Smoke das telas públicas: abrem com os dados mockados e sem erro no console.
test.describe('Telas públicas', () => {
  test('home lista os campeonatos em destaque', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Campeonatos em destaque' })).toBeVisible()
    await expect(page.getByText('Copa Footfy')).toBeVisible()
  })

  test('lista de campeonatos', async ({ page }) => {
    await page.goto('/campeonatos')
    await expect(page.getByRole('heading', { name: 'Campeonatos', exact: true })).toBeVisible()
    await expect(page.getByText('Torneio de Verão')).toBeVisible()
  })

  test('detalhe do campeonato com as ligas', async ({ page }) => {
    await page.goto('/campeonatos/1')
    await expect(page.getByText('Copa Footfy')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ligas' })).toBeVisible()
    await expect(page.getByText('Série B')).toBeVisible()
  })

  test('liga com times, tabela e estatísticas', async ({ page }) => {
    await page.goto('/ligas/1')
    await expect(page.getByRole('heading', { name: 'Série A' })).toBeVisible()
    await expect(page.getByText('Atlético Serrano')).toBeVisible()

    await page.getByRole('tab', { name: 'Tabela' }).click()
    await expect(page.locator('[data-test=standings-row]')).toHaveCount(4)

    await page.getByRole('tab', { name: 'Estatísticas' }).click()
    await expect(page.locator('[data-test=top-scorers]')).toContainText('Lucas Ferreira')
  })

  test('detalhe do time com o elenco', async ({ page }) => {
    await page.goto('/times/1')
    await expect(page.getByText('Atlético Serrano')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Lucas Ferreira' })).toBeVisible()

    await page.getByRole('tab', { name: 'Comissão Técnica' }).click()
    await expect(page.getByRole('cell', { name: 'Carlos Andrade' })).toBeVisible()
  })

  test('partida (placeholder): Voltar sem histórico vai para os campeonatos', async ({ page }) => {
    await page.goto('/partidas/1')
    await expect(page.getByText('Detalhes da partida em breve')).toBeVisible()

    // BUG-030: aberta direto, o Voltar saía do app.
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/campeonatos$/)
    await expect(page.getByText('Torneio de Verão')).toBeVisible()
  })

  test('login com CPF e senha leva à seleção de campeonato', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'CPF' }).fill('45047364895')
    await page.getByRole('textbox', { name: 'Senha' }).fill('123456')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/admin\/selecionar$/)
    await expect(page.getByRole('heading', { name: 'Escolha o campeonato' })).toBeVisible()
  })
})
