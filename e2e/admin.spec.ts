import { expect, openDialog, signIn, test } from './support/test'

// Smoke do painel: cada tela abre com os dados mockados e sem erro no console.
test.describe('Seleção de campeonato e liga', () => {
  test('master sem liga ativa escolhe campeonato e liga até o dashboard', async ({ page }) => {
    await signIn(page, { leagueId: null })
    await page.goto('/admin')

    await expect(page).toHaveURL(/\/admin\/selecionar$/)
    await expect(page.locator('[data-test=championship-card]')).toHaveCount(2)
    await page.locator('[data-test=championship-card]', { hasText: 'Copa Footfy' }).click()

    await expect(page.locator('[data-test=league-card]')).toHaveCount(2)
    await page.locator('[data-test=league-card]', { hasText: 'Série A' }).click()

    await expect(page).toHaveURL(/\/admin\/liga\/1$/)
    await expect(page.locator('[data-test=dashboard-header]')).toContainText('Série A')
  })

  test('estado vazio quando o usuário não tem ligas', async ({ page, api }) => {
    api.on('GET', '/leagues', { body: { data: [] } })
    await signIn(page, { role: 'admin', leagueId: null })
    await page.goto('/admin/selecionar')

    await expect(page.locator('[data-test=empty-state]')).toBeVisible()
  })

  test('liga fora do escopo volta para a seleção com acesso negado', async ({ page }) => {
    await signIn(page, { role: 'admin' })
    await page.goto('/admin/liga/999')

    await expect(page).toHaveURL(/\/admin\/selecionar\?negado=1$/)
    await expect(page.locator('[data-test=access-denied]')).toBeVisible()
  })
})

test.describe('Telas da liga', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('dashboard', async ({ page }) => {
    await page.goto('/admin/liga/1')
    await expect(page.locator('[data-test=dashboard-header]')).toContainText('Série A')
    await expect(page.locator('[data-test=dashboard-counter]')).toHaveCount(4)
    await expect(page.locator('[data-test=goals-chart]')).toBeVisible()
    await expect(page.locator('[data-test=cards-chart]')).toBeVisible()
  })

  test('lista de times', async ({ page }) => {
    await page.goto('/admin/liga/1/times')
    await expect(page.locator('[data-test=team-card]')).toHaveCount(4)
  })

  test('detalhe do time com elenco, comissão e estatísticas', async ({ page }) => {
    await page.goto('/admin/liga/1/times/1')
    await expect(page.locator('[data-test=team-title]')).toHaveText('Atlético Serrano')
    await expect(page.locator('[data-test=players-table]')).toContainText('Lucas Ferreira')

    await page.getByRole('tab', { name: 'Comissão Técnica' }).click()
    await expect(page.locator('[data-test=members-table]')).toContainText('Carlos Andrade')

    await page.getByRole('tab', { name: 'Estatísticas' }).click()
    await expect(page.locator('[data-test=team-stats]')).toBeVisible()
  })

  test('detalhe do jogador', async ({ page }) => {
    await page.goto('/admin/liga/1/times/1/jogadores/4')
    await expect(page.locator('[data-test=player-title]')).toContainText('Lucas Ferreira')
    await expect(page.locator('[data-test=player-profile]')).toBeVisible()

    await page.getByRole('tab', { name: 'Estatísticas' }).click()
    await expect(page.locator('[data-test=player-stats]')).toBeVisible()
  })

  test('detalhe do membro da comissão técnica', async ({ page }) => {
    await page.goto('/admin/liga/1/times/1/comissao-tecnica/1')
    await expect(page.locator('[data-test=member-title]')).toContainText('Carlos Andrade')
  })

  test('estádios', async ({ page }) => {
    await page.goto('/admin/liga/1/estadios')
    await expect(page.locator('[data-test=stadiums-table]')).toContainText('Estádio Municipal')
  })

  test('lista de partidas', async ({ page }) => {
    await page.goto('/admin/liga/1/partidas')
    await expect(page.locator('[data-test=games-table] tbody tr')).toHaveCount(6)
  })

  test('detalhe da partida com a súmula', async ({ page }) => {
    await page.goto('/admin/liga/1/partidas/1')
    await expect(page.locator('[data-test=game-score]')).toHaveText('2 × 1')
    await expect(page.locator('[data-test=game-details]')).toContainText('Estádio Municipal')

    await page.getByRole('tab', { name: 'Súmula' }).click()
    await expect(page.locator('[data-test=event-row]')).toHaveCount(4)
  })

  test('usuários', async ({ page }) => {
    await page.goto('/admin/liga/1/usuarios')
    await expect(page.locator('[data-test=users-table]')).toContainText('Carla Técnica')
  })

  test('tabela', async ({ page }) => {
    await page.goto('/admin/liga/1/tabela')
    await expect(page.locator('[data-test=standings-row]')).toHaveCount(4)
  })

  test('estatísticas', async ({ page }) => {
    await page.goto('/admin/liga/1/estatisticas')
    await expect(page.locator('[data-test=top-scorers]')).toContainText('Lucas Ferreira')
  })

  test('meu perfil', async ({ page }) => {
    await page.goto('/admin/perfil')
    await expect(page.locator('[data-test=account-name] input')).toHaveValue('Ana Master')
  })

  test('admin vê partidas e usuários pelas permissões do papel', async ({ page }) => {
    await signIn(page, { role: 'admin' })
    await page.goto('/admin/liga/1/partidas')
    await expect(page.locator('[data-test=game-create]')).toBeVisible()
    await page.locator('.v-navigation-drawer').getByRole('link', { name: 'Usuários' }).click()
    await expect(page.locator('[data-test=users-table]')).toContainText('Carla Técnica')
  })
})

test.describe('Formulários de criação e edição', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('novo time', async ({ page }) => {
    await page.goto('/admin/liga/1/times')
    await page.locator('[data-test=team-create]').click()
    await expect(openDialog(page)).toContainText('Novo time')
  })

  test('editar time, novo jogador e novo membro da comissão', async ({ page }) => {
    await page.goto('/admin/liga/1/times/1')

    await page.locator('[data-test=team-edit]').click()
    await expect(openDialog(page)).toContainText('Editar time')
    await expect(openDialog(page).locator('[data-test=team-name] input')).toHaveValue(
      'Atlético Serrano',
    )
    await page.keyboard.press('Escape')
    await expect(openDialog(page)).toHaveCount(0)

    await page.locator('[data-test=player-create]').click()
    await expect(openDialog(page)).toContainText('Novo jogador')
    await page.keyboard.press('Escape')
    await expect(openDialog(page)).toHaveCount(0)

    await page.getByRole('tab', { name: 'Comissão Técnica' }).click()
    await page.locator('[data-test=member-create]').click()
    await expect(openDialog(page)).toContainText('Novo membro da comissão')
  })

  test('novo e editar estádio', async ({ page }) => {
    await page.goto('/admin/liga/1/estadios')

    await page.locator('[data-test=stadium-create]').click()
    await expect(openDialog(page)).toContainText('Novo estádio')
    await page.keyboard.press('Escape')
    await expect(openDialog(page)).toHaveCount(0)

    await page.locator('[data-test=stadium-edit]').first().click()
    await expect(openDialog(page)).toContainText('Editar estádio')
    await expect(openDialog(page).getByLabel('Nome')).toHaveValue('Estádio Municipal')
  })

  test('nova e editar partida', async ({ page }) => {
    await page.goto('/admin/liga/1/partidas')

    await page.locator('[data-test=game-create]').click()
    await expect(openDialog(page)).toContainText('Nova partida')
    await page.keyboard.press('Escape')
    await expect(openDialog(page)).toHaveCount(0)

    await page.locator('[data-test=game-edit]').first().click()
    await expect(openDialog(page)).toContainText('Editar partida')
  })

  test('registrar evento na súmula', async ({ page }) => {
    await page.goto('/admin/liga/1/partidas/1?tab=sumula')
    await page.locator('[data-test=event-create]').click()
    await expect(openDialog(page)).toContainText('Registrar evento')
  })

  test('novo e editar usuário', async ({ page }) => {
    await page.goto('/admin/liga/1/usuarios')

    await page.locator('[data-test=user-create]').click()
    await expect(openDialog(page)).toContainText('Novo usuário')
    await page.keyboard.press('Escape')
    await expect(openDialog(page)).toHaveCount(0)

    await page
      .getByRole('row', { name: /Carla Técnica/ })
      .locator('[data-test=user-edit]')
      .click()
    await expect(openDialog(page)).toContainText('Editar usuário')
    await expect(openDialog(page).locator('[data-test=user-name] input')).toHaveValue(
      'Carla Técnica',
    )
  })
})

test.describe('Campeonatos (master)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, { leagueId: null })
  })

  test('lista', async ({ page }) => {
    await page.goto('/admin/campeonatos')
    await expect(page.getByRole('heading', { name: 'Campeonatos' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Copa Footfy' })).toBeVisible()
  })

  test('novo campeonato', async ({ page }) => {
    await page.goto('/admin/campeonatos/novo')
    await expect(page.getByRole('heading', { name: 'Novo Campeonato' })).toBeVisible()
    await expect(page.getByLabel('Nome')).toHaveValue('')
  })

  test('editar campeonato', async ({ page }) => {
    await page.goto('/admin/campeonatos/1/editar')
    await expect(page.getByRole('heading', { name: 'Editar Campeonato' })).toBeVisible()
    await expect(page.getByLabel('Nome')).toHaveValue('Copa Footfy')
  })
})
