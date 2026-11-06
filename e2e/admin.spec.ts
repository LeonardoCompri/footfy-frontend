import type { Page } from '@playwright/test'
import { API_BASE_URL } from './support/env'
import { samplePng, sampleImageUrl } from './support/images'
import { fixture } from './support/mock-api'
import { DESKTOP, expect, MOBILE, openDialog, pickOption, signIn, test } from './support/test'

function apiCalls(page: Page) {
  const calls: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.href.startsWith(`${API_BASE_URL}/`) || request.method() === 'OPTIONS') return
    calls.push(`${request.method()} ${url.pathname.slice(new URL(API_BASE_URL).pathname.length)}`)
  })
  return calls
}

const PREVIEW_IMG =
  '[data-test=championship-image-preview] [data-test=championship-image-front] img'

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
    await page.goto('/admin/liga/1/times/1')
    await expect(page.locator('[data-test=player-view]').first()).toBeVisible()
    await expect(page.locator('[data-test=player-edit], [data-test=player-delete]')).toHaveCount(0)
    await page.getByRole('link', { name: 'Ver jogador Lucas Ferreira' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/times\/1\/jogadores\/4$/)
    await expect(page.locator('[data-test=player-title]')).toContainText('Lucas Ferreira')
    await expect(page.locator('[data-test=player-edit]')).toBeVisible()
    await expect(page.locator('[data-test=player-delete]')).toBeVisible()
    await expect(page.locator('[data-test=player-profile]')).toBeVisible()

    await page.getByRole('tab', { name: 'Estatísticas' }).click()
    await expect(page.locator('[data-test=player-stats]')).toBeVisible()
  })

  test('detalhe do membro da comissão técnica', async ({ page }) => {
    await page.goto('/admin/liga/1/times/1?tab=comissao')
    await expect(page.locator('[data-test=member-edit], [data-test=member-delete]')).toHaveCount(0)
    await page.getByRole('link', { name: 'Ver membro Carlos Andrade' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/times\/1\/comissao-tecnica\/1$/)
    await expect(page.locator('[data-test=member-title]')).toContainText('Carlos Andrade')
    await expect(page.locator('[data-test=member-edit]')).toBeVisible()
    await expect(page.locator('[data-test=member-delete]')).toBeVisible()
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
    const calls = apiCalls(page)
    await page.goto('/admin/liga/1/partidas/1')
    await expect(page.locator('[data-test=game-score]')).toHaveText('2 × 1')
    await expect(page.locator('[data-test=game-details]')).toContainText('Estádio Municipal')

    await page.getByRole('tab', { name: 'Súmula' }).click()
    const rows = page.locator('[data-test=event-row]')
    await expect(rows).toHaveCount(4)
    await expect(rows.first()).toContainText("78'")
    await expect(rows.first()).toContainText('Gol · Serrano')
    await expect(rows.last()).toContainText("23'")
    await expect(page.locator('[data-test=event-action]')).toHaveText([
      'Gol',
      'Gol contra',
      'Cartão amarelo',
      'Cartão vermelho',
    ])
    expect(calls.filter((call) => /\/(game-events|teams)/.test(call))).toEqual([])
    expect(calls).toContain('GET /event-types')
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
    await expect(page.locator('[data-test=game-view]')).toHaveCount(6)
    await expect(page.locator('[data-test=game-edit], [data-test=game-delete]')).toHaveCount(0)
    await page.locator('.v-navigation-drawer').getByRole('link', { name: 'Usuários' }).click()
    await expect(page.locator('[data-test=users-table]')).toContainText('Carla Técnica')
  })
})

test.describe('Lista de partidas', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  function gameQueries(page: Page) {
    const queries: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (request.method() === 'GET' && url.href.startsWith(`${API_BASE_URL}/games?`)) {
        url.searchParams.delete('league_id')
        queries.push(url.searchParams.toString())
      }
    })
    return queries
  }

  test('o olho abre o detalhe e "Partidas" volta com os filtros aplicados', async ({ page }) => {
    const queries = gameQueries(page)
    await page.goto('/admin/liga/1/partidas')
    await expect(page.locator('[data-test=games-table] tbody tr')).toHaveCount(6)

    await page.locator('[data-test=game-status-filter]').click()
    await pickOption(page, 'Finalizada')
    await page.locator('[data-test=game-search]').click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\?status=finished$/)

    const view = page.locator('[data-test=game-view][href$="/partidas/1"]')
    await expect(view).toHaveAttribute('aria-label', 'Ver partida Serrano × Ribeirinho')
    await view.click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\/1$/)
    await expect(page.locator('[data-test=game-score]')).toHaveText('2 × 1')
    await page.getByRole('tab', { name: 'Súmula' }).click()
    await expect(page).toHaveURL(/\?tab=sumula$/)

    await page.locator('[data-test=back-to-games]').click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\?status=finished$/)
    await expect(page.locator('[data-test=game-status-filter]')).toContainText('Finalizada')
    await expect(page.locator('[data-test=games-table] tbody tr')).toHaveCount(6)
    expect(queries).toEqual([
      'page=1&per_page=20',
      'page=1&per_page=20&status=finished',
      'page=1&per_page=20&status=finished',
    ])
  })

  test('excluir pelo detalhe volta para a lista com os filtros', async ({ page, api }) => {
    let deleted = false
    api.on('DELETE', '/games/1', () => {
      deleted = true
      return { status: 204 }
    })
    await page.goto('/admin/liga/1/partidas?status=finished&per_page=10')
    await expect(page.locator('[data-test=game-status-filter]')).toContainText('Finalizada')

    await page.locator('[data-test=game-view][href$="/partidas/1"]').click()
    await page.locator('[data-test=game-delete]').click()
    await openDialog(page).getByRole('button', { name: 'Excluir' }).click()

    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\?status=finished&per_page=10$/)
    expect(deleted).toBe(true)
    await expect(page.locator('[data-test=game-status-filter]')).toContainText('Finalizada')
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

  test('nova partida sem status e gols; editar mostra só o status', async ({ page, api }) => {
    let created: Record<string, unknown> = {}
    api.on('POST', '/games', ({ request }) => {
      created = request.postDataJSON() as Record<string, unknown>
      return { status: 201, body: fixture('game-1') }
    })
    await page.goto('/admin/liga/1/partidas')

    await page.locator('[data-test=game-create]').click()
    const dialog = openDialog(page)
    await expect(dialog).toContainText('Nova partida')
    await expect(dialog.locator('[data-test=game-status]')).toHaveCount(0)
    await expect(dialog.locator('[data-test=game-home-score]')).toHaveCount(0)
    await expect(dialog.locator('[data-test=game-away-score]')).toHaveCount(0)
    await dialog.locator('[data-test=game-home-team]').click()
    await pickOption(page, 'Atlético Serrano')
    await dialog.locator('[data-test=game-away-team]').click()
    await pickOption(page, 'Clube Ribeirinho')
    await dialog.locator('[data-test=form-submit]').click()

    await expect(page).toHaveURL(/\/admin\/liga\/1\/partidas\/1$/)
    expect(created).toMatchObject({ home_team_id: 1, away_team_id: 2, status: 'scheduled' })
    expect(created).not.toHaveProperty('home_score')
    expect(created).not.toHaveProperty('away_score')

    let updated: Record<string, unknown> = {}
    api.on('PUT', '/games/1', ({ request }) => {
      updated = request.postDataJSON() as Record<string, unknown>
      return { body: fixture('game-1') }
    })
    await page.locator('[data-test=game-edit]').click()
    const edit = openDialog(page)
    await expect(edit).toContainText('Editar partida')
    await expect(edit.locator('[data-test=game-status]')).toBeVisible()
    await expect(edit.locator('[data-test=game-home-score]')).toHaveCount(0)
    await expect(edit.locator('[data-test=game-away-score]')).toHaveCount(0)
    await edit.locator('[data-test=form-submit]').click()
    await expect(openDialog(page)).toHaveCount(0)
    expect(updated).toMatchObject({ home_team_id: 1, away_team_id: 2 })
    expect(updated).not.toHaveProperty('home_score')
    expect(updated).not.toHaveProperty('away_score')
  })

  test('registrar gol contra na súmula recarrega a partida', async ({ page, api }) => {
    let posted: Record<string, unknown> = {}
    api.on('POST', '/game-events', ({ request }) => {
      posted = request.postDataJSON() as Record<string, unknown>
      return { status: 201, body: { data: { id: 9, league_id: 1, ...posted } } }
    })
    const calls = apiCalls(page)
    await page.goto('/admin/liga/1/partidas/1?tab=sumula')
    await expect(page.locator('[data-test=event-row]')).toHaveCount(4)

    await page.getByRole('button', { name: 'Gol contra', exact: true }).click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=event-form-title]')).toHaveText('Registrar Gol contra')
    await expect(dialog.locator('[data-test=event-type]')).toHaveCount(0)
    await expect(dialog).toContainText('o evento conta para o adversário')
    await expect(dialog.locator('[data-test=event-assist]')).toHaveCount(0)
    await dialog.locator('[data-test=event-team]').click()
    await pickOption(page, 'Ribeirinho')
    await dialog.locator('[data-test=event-player]').click()
    await pickOption(page, '10 · Gustavo Pires')
    await dialog.locator('[data-test=form-submit]').click()

    await expect(openDialog(page)).toHaveCount(0)
    expect(posted).toMatchObject({
      game_id: 1,
      team_id: 2,
      player_id: 8,
      type: 'own_goal',
      related_player_id: null,
    })
    await expect.poll(() => calls.filter((call) => call === 'GET /games/1').length).toBe(2)
    expect(calls.filter((call) => call.includes('/teams'))).toEqual([])
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

  test('novo campeonato com duas ligas', async ({ page, api }) => {
    let body = ''
    api.on('POST', '/championships', ({ request }) => {
      body = request.postData() ?? ''
      return { status: 201, body: { data: { id: 9, name: 'Copa Nova', image: null, leagues: [] } } }
    })

    await page.goto('/admin/campeonatos/novo')
    await expect(page.getByRole('heading', { name: 'Novo Campeonato' })).toBeVisible()
    await expect(page.locator('[data-test=championship-name] input')).toHaveValue('')
    await expect(page.locator('[data-test=leagues-empty]')).toBeVisible()

    await page.locator('[data-test=championship-name] input').fill('Copa Nova')
    await expect(page.locator('[data-test=championship-image-preview-open]')).toBeDisabled()
    await page.locator('[data-test=championship-image-input]').setInputFiles({
      name: 'copa.png',
      mimeType: 'image/png',
      buffer: await samplePng(page, 'Copa Nova', '#1565c0'),
    })
    await expect(page.locator(PREVIEW_IMG)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remover imagem' })).toBeVisible()
    await expect(page.locator('[data-test=championship-image-preview-open]')).toBeEnabled()

    await page.locator('[data-test=league-add]').click()
    await page.locator('[data-test=league-add]').click()
    await expect(page.locator('[data-test=leagues-count]')).toHaveText('2')

    const names = page.locator('[data-test=league-name] input')
    await names.nth(0).fill('Liga Ouro')
    await names.nth(1).fill('Liga Prata')
    await page.locator('[data-test=league-format]').nth(1).click()
    await pickOption(page, 'Mata-mata')
    await page.locator('[data-test=league-start-date] input').nth(1).fill('2026-04-01')
    await page.locator('[data-test=league-end-date] input').nth(1).fill('2026-06-30')
    await page.locator('[data-test=championship-submit]').click()

    await expect(page).toHaveURL(/\/admin\/campeonatos$/)
    await expect(page.getByText('Campeonato criado com sucesso.')).toBeVisible()
    expect(body).toContain('name="leagues[0][name]"\r\n\r\nLiga Ouro')
    expect(body).toContain('name="leagues[0][format]"\r\n\r\nround_robin')
    expect(body).toContain('name="leagues[1][name]"\r\n\r\nLiga Prata')
    expect(body).toContain('name="leagues[1][format]"\r\n\r\nknockout')
    expect(body).toContain('name="leagues[1][end_date]"\r\n\r\n2026-06-30')
    expect(body).not.toContain('[id]')
    expect(body).toContain('name="image"; filename="copa.png"')
  })

  test('editar campeonato e adicionar uma liga', async ({ page, api }) => {
    let body = ''
    let method = ''
    api.on('POST', '/championships/1', ({ request, url }) => {
      body = request.postData() ?? ''
      method = url.searchParams.get('_method') ?? ''
      return { body: { data: { id: 1, name: 'Copa Footfy', image: null, leagues: [] } } }
    })

    await page.goto('/admin/campeonatos/1/editar')
    await expect(page.getByRole('heading', { name: 'Editar Campeonato' })).toBeVisible()
    await expect(page.locator('[data-test=championship-name] input')).toHaveValue('Copa Footfy')
    await expect(page.locator('[data-test=league-panel-title]')).toHaveText(['Série A', 'Série B'])

    await page.locator('[data-test=league-add]').click()
    await page.locator('[data-test=league-name] input').nth(2).fill('Série C')
    await expect(page.locator('[data-test=league-panel-title]').nth(2)).toHaveText('Série C')
    await page.locator('[data-test=championship-submit]').click()

    await expect(page).toHaveURL(/\/admin\/campeonatos$/)
    expect(method).toBe('PUT')
    expect(body).toContain('name="leagues[0][id]"\r\n\r\n1')
    expect(body).toContain('name="leagues[1][id]"\r\n\r\n2')
    expect(body).toContain('name="leagues[2][name]"\r\n\r\nSérie C')
    expect(body).not.toContain('leagues[2][id]')
    expect(body).not.toContain('name="image"')
  })

  test('imagem salva: visualizar aplicação, trocar e remover (image vazio)', async ({
    page,
    api,
  }) => {
    const championship = fixture<{ data: { image: string | null } }>('championship-1')
    championship.data.image = sampleImageUrl('Copa Footfy', '#2e7d32')
    let body = ''
    api
      .on('GET', '/championships/1', { body: championship })
      .on('POST', '/championships/1', ({ request }) => {
        body = request.postData() ?? ''
        return { body: { data: { id: 1, name: 'Copa Footfy', image: null, leagues: [] } } }
      })

    await page.goto('/admin/campeonatos/1/editar')
    const preview = page.locator(PREVIEW_IMG)
    await expect(preview).toHaveAttribute('src', /^data:image\/svg/)
    await expect(page.getByRole('button', { name: 'Remover imagem' })).toBeVisible()

    await page.getByRole('button', { name: 'Visualizar aplicação' }).click()
    const dialog = openDialog(page)
    await expect(dialog).toContainText('Como a imagem aparece')
    await expect(dialog.locator('[data-test=preview-dashboard]')).toContainText('Série A')
    await expect(dialog.locator('[data-test=championship-image-front] img')).toHaveCount(4)
    await expect(dialog.locator('.championship-image__backdrop')).toHaveCount(4)
    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(openDialog(page)).toHaveCount(0)

    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Trocar imagem' }).click()
    await (
      await chooser
    ).setFiles({
      name: 'nova.png',
      mimeType: 'image/png',
      buffer: await samplePng(page, 'Nova', '#c62828'),
    })
    await expect(preview).toHaveAttribute('src', /^blob:/)

    await page.getByRole('button', { name: 'Remover imagem' }).click()
    await expect(page.locator('[data-test=championship-image-empty]')).toBeVisible()
    await expect(page.locator('[data-test=championship-image-preview-open]')).toBeDisabled()
    await page.locator('[data-test=championship-submit]').click()

    await expect(page).toHaveURL(/\/admin\/campeonatos$/)
    expect(body).toContain('name="image"\r\n\r\n\r\n')
    expect(body).not.toContain('filename=')
  })

  test('arquivo de imagem inválido não entra na prévia e mostra o erro', async ({ page }) => {
    await page.goto('/admin/campeonatos/novo')
    const input = page.locator('[data-test=championship-image-input]')
    const error = page.locator('[data-test=championship-image-error]')
    await expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')

    await input.setInputFiles({
      name: 'copa.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('GIF89a'),
    })
    await expect(error).toHaveText('Use uma imagem JPG, PNG ou WebP.')
    await expect(page.locator('[data-test=championship-image-empty]')).toBeVisible()

    await input.setInputFiles({
      name: 'grande.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    })
    await expect(error).toHaveText('A imagem deve ter no máximo 2 MB.')
    await expect(page.locator('[data-test=championship-image-empty]')).toBeVisible()
    await expect(page.locator('[data-test=championship-image-preview-open]')).toBeDisabled()

    await input.setInputFiles({
      name: 'copa.png',
      mimeType: 'image/png',
      buffer: await samplePng(page, 'Copa', '#1565c0'),
    })
    await expect(page.locator(PREVIEW_IMG)).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('excluir liga pede a senha: errada e depois a certa', async ({ page, api }) => {
    await signIn(page, { leagueId: 2 })
    const passwords: string[] = []
    api.allowConsoleError(/status of 422/).on('DELETE', '/leagues/2', ({ request }) => {
      const { password } = request.postDataJSON() as { password: string }
      passwords.push(password)
      if (password !== '123456') {
        return {
          status: 422,
          body: { message: 'Senha incorreta.', errors: { password: ['Senha incorreta.'] } },
        }
      }
      return { status: 204 }
    })

    await page.goto('/admin/campeonatos/1/editar')
    const panel = page.locator('[data-test=league-panel]', { hasText: 'Série B' })
    await panel.locator('.v-expansion-panel-title').click()
    await panel.locator('[data-test=league-remove]').click()

    const dialog = openDialog(page)
    await expect(dialog).toContainText('A exclusão é imediata')
    await dialog.locator('[data-test=password-delete-continue]').click()
    await dialog.locator('[data-test=password-delete-password] input').fill('errada')
    await dialog.locator('[data-test=password-delete-confirm]').click()
    await expect(dialog).toContainText('Senha incorreta.')

    await dialog.locator('[data-test=password-delete-password] input').fill('123456')
    await dialog.locator('[data-test=password-delete-confirm]').click()

    await expect(openDialog(page)).toHaveCount(0)
    await expect(page.getByText('Liga excluída com sucesso.')).toBeVisible()
    await expect(page.locator('[data-test=league-panel-title]')).toHaveText(['Série A'])
    expect(passwords).toEqual(['errada', '123456'])
    expect(await page.evaluate(() => localStorage.getItem('footfy_active_league'))).toBeNull()
  })

  test('excluir campeonato pela lista pede a senha: errada e depois a certa', async ({
    page,
    api,
  }) => {
    await signIn(page, { leagueId: 2 })
    const passwords: string[] = []
    let deleted = false
    api
      .allowConsoleError(/status of 422/)
      .on('DELETE', '/championships/1', ({ request }) => {
        const { password } = request.postDataJSON() as { password: string }
        passwords.push(password)
        if (password !== '123456') {
          return {
            status: 422,
            body: { message: 'Senha incorreta.', errors: { password: ['Senha incorreta.'] } },
          }
        }
        deleted = true
        return { status: 204 }
      })
      .on('GET', '/championships', () => {
        const list = fixture<{ data: { id: number }[] }>('championships')
        if (deleted) list.data = list.data.filter((item) => item.id !== 1)
        return { body: list }
      })

    await page.goto('/admin/campeonatos')
    await page
      .getByRole('row', { name: /Copa Footfy/ })
      .getByRole('button', { name: 'Excluir campeonato' })
      .click()

    const dialog = openDialog(page)
    await expect(dialog).toContainText('Excluir campeonato Copa Footfy')
    await expect(dialog.locator('[data-test=championship-delete-leagues]')).toHaveText(
      'Serão apagadas 2 ligas: Série A, Série B.',
    )
    await expect(dialog).toContainText('a imagem do campeonato')
    await expect(dialog).toContainText('Times, jogadores, comissão técnica e usuários')
    await dialog.locator('[data-test=password-delete-continue]').click()
    await dialog.locator('[data-test=password-delete-password] input').fill('errada')
    await dialog.locator('[data-test=password-delete-confirm]').click()
    await expect(dialog).toContainText('Senha incorreta.')

    await dialog.locator('[data-test=password-delete-password] input').fill('123456')
    await dialog.locator('[data-test=password-delete-confirm]').click()

    await expect(openDialog(page)).toHaveCount(0)
    await expect(page.getByText('Campeonato excluído com sucesso.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Copa Footfy' })).toHaveCount(0)
    expect(passwords).toEqual(['errada', '123456'])
    expect(await page.evaluate(() => localStorage.getItem('footfy_active_league'))).toBeNull()
  })

  test('campeonato sem ligas: card, mensagem e atalho para gerenciar', async ({ page, api }) => {
    const empty = { id: 3, name: 'Copa Sem Ligas', image: null }
    api
      .on('GET', '/championships', {
        body: { data: [...fixture<{ data: object[] }>('championships').data, empty] },
      })
      .on('GET', '/championships/3', { body: { data: { ...empty, leagues: [] } } })

    await page.goto('/admin/selecionar')
    const card = page.locator('[data-test=championship-card]', { hasText: 'Copa Sem Ligas' })
    await expect(card).toContainText('Sem ligas')
    await card.click()

    await expect(page).toHaveURL(/\/admin\/selecionar\/3$/)
    await expect(page.locator('[data-test=no-leagues]')).toContainText(
      'Sem ligas para esse campeonato.',
    )
    await page.getByRole('link', { name: 'Gerenciar campeonato' }).click()

    await expect(page).toHaveURL(/\/admin\/campeonatos\/3\/editar$/)
    await expect(page.locator('[data-test=championship-name] input')).toHaveValue('Copa Sem Ligas')
    await expect(page.locator('[data-test=leagues-empty]')).toBeVisible()
  })
})

test.describe('Regulamento da liga', () => {
  type Body<T = Record<string, unknown>> = { data: T }
  interface GroupsBody {
    fixture_mode: string
    groups_count: number
    locked: boolean
    groups: { group_number: number; teams: { id: number; name: string }[] }[]
    unassigned: { id: number; name: string }[]
  }

  function leagueBody(extra: Record<string, unknown> = {}): Body {
    const body = fixture<Body>('league-1')
    return { data: { ...body.data, format: 'hybrid', ...extra } }
  }

  function groupsBody(extra: Partial<GroupsBody> = {}): Body<GroupsBody> {
    const body = fixture<Body<GroupsBody>>('league-1-groups')
    return { data: { ...body.data, ...extra } }
  }

  function assignedGroups(extra: Partial<GroupsBody> = {}): Body<GroupsBody> {
    const teams = groupsBody().data.unassigned
    return groupsBody({
      fixture_mode: 'draw',
      groups_count: 2,
      groups: [
        { group_number: 1, teams: teams.slice(0, 2) },
        { group_number: 2, teams: teams.slice(2) },
      ],
      unassigned: [],
      ...extra,
    })
  }

  const HYBRID_DRAW = {
    fixture_mode: 'draw',
    groups_count: 2,
    group_legs: 1,
    qualifiers_per_group: 1,
    knockout_size: 2,
    knockout_legs: 1,
    final_legs: 1,
    third_place: false,
    tiebreakers: null,
    knockout_tiebreakers: ['penalties'],
  }

  async function choose(page: Page, field: string, option: string) {
    await page.locator(`[data-test=${field}]`).click()
    await pickOption(page, option)
  }

  function teamRow(page: Page, name: string) {
    return page.locator('[data-test=group-team]', { hasText: name })
  }

  test('admin configura o sorteio, salva só o regulamento e monta os grupos', async ({
    page,
    api,
  }) => {
    await signIn(page, { role: 'admin' })
    let groups = groupsBody()
    let sent: Record<string, unknown> = {}
    let assignments: unknown = null
    api
      .on('GET', '/leagues/1', { body: leagueBody() })
      .on('GET', '/leagues/1/groups', () => ({ body: groups }))
      .on('PUT', '/leagues/1', ({ request }) => {
        sent = request.postDataJSON() as Record<string, unknown>
        groups = groupsBody({
          fixture_mode: 'draw',
          groups_count: 2,
          groups: [
            { group_number: 1, teams: [] },
            { group_number: 2, teams: [] },
          ],
        })
        return { body: leagueBody(sent) }
      })
      .on('POST', '/leagues/1/groups/shuffle', () => ({ body: assignedGroups() }))
      .on('PUT', '/leagues/1/groups', ({ request }) => {
        assignments = (request.postDataJSON() as { groups: unknown }).groups
        return { body: assignedGroups() }
      })

    await page.goto('/admin/liga/1')
    await page.locator('.v-navigation-drawer').getByRole('link', { name: 'Regulamento' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/regulamento$/)
    await expect(page.locator('[data-test=rules-format] input')).toHaveValue('Grupos + mata-mata')
    await expect(page.locator('[data-test=rules-summary]')).toHaveText('4 times → 1 grupo de 4')

    await choose(page, 'rules-fixture-mode', 'Sorteio')
    await page.locator('[data-test=rules-submit]').click()
    await expect(page.locator('[data-test=rules-qualifiers]')).toContainText(
      'Obrigatório para o sorteio.',
    )

    await choose(page, 'rules-groups-count', '2')
    await choose(page, 'rules-qualifiers', '1')
    await choose(page, 'rules-knockout-size', 'Final')
    await choose(page, 'rules-knockout-legs', 'Jogo único')
    await choose(page, 'rules-final-legs', 'Jogo único')
    await choose(page, 'rules-knockout-tiebreakers', 'Pênaltis')
    await expect(page.locator('[data-test=rules-summary]')).toHaveText(
      '4 times → 2 grupos de 2 → 2 classificados → Final',
    )
    await expect(page.locator('[data-test=groups-pending]')).toBeVisible()

    await page.locator('[data-test=rules-submit]').click()
    await expect(page.getByText('Regulamento salvo com sucesso.')).toBeVisible()
    expect(sent).toEqual(HYBRID_DRAW)

    await expect(page.locator('[data-test=groups-unassigned] [data-test=group-team]')).toHaveCount(4)
    await page.locator('[data-test=groups-shuffle]').click()
    const groupA = page.locator('[data-test=group-card]', { hasText: 'Grupo A' })
    await expect(groupA.locator('[data-test=group-team]')).toHaveCount(2)
    await expect(page.locator('[data-test=groups-unassigned]')).toHaveCount(0)

    await teamRow(page, 'Atlético Serrano').locator('[data-test=group-team-select]').click()
    await pickOption(page, 'Grupo B')
    await page.locator('[data-test=groups-save]').click()
    await expect(page.locator('[data-test=groups-error]')).toHaveText(
      'Todos os grupos devem ter o mesmo número de times (2 por grupo).',
    )

    await teamRow(page, 'Estrela do Vale').locator('[data-test=group-team-select]').click()
    await pickOption(page, 'Grupo A')
    await page.locator('[data-test=groups-save]').click()
    await expect(page.getByText('Grupos salvos com sucesso.')).toBeVisible()
    expect(assignments).toEqual([
      { team_id: 1, group_number: 2 },
      { team_id: 2, group_number: 1 },
      { team_id: 3, group_number: 1 },
      { team_id: 4, group_number: 2 },
    ])
  })

  test('liga com rodadas sorteadas fica travada e os grupos só leitura', async ({ page, api }) => {
    await signIn(page)
    api
      .on('GET', '/leagues/1', { body: leagueBody(HYBRID_DRAW) })
      .on('GET', '/leagues/1/groups', { body: assignedGroups({ locked: true }) })

    await page.goto('/admin/liga/1/regulamento')
    await expect(page.locator('[data-test=rules-locked]')).toBeVisible()
    await expect(page.locator('[data-test=rules-groups-count] input')).toBeDisabled()
    await expect(page.locator('[data-test=groups-locked]')).toContainText(
      'A liga já tem rodadas sorteadas',
    )
    await expect(page.locator('[data-test=groups-shuffle]')).toHaveCount(0)
    await expect(page.locator('[data-test=group-team-select]')).toHaveCount(0)
  })

  for (const [name, viewport] of [
    ['mobile', MOBILE],
    ['desktop', DESKTOP],
  ] as const) {
    test(`${name}: formulário e grupos sem rolagem horizontal`, async ({ page, api }) => {
      await page.setViewportSize(viewport)
      await signIn(page)
      api
        .on('GET', '/leagues/1', { body: leagueBody(HYBRID_DRAW) })
        .on('GET', '/leagues/1/groups', { body: assignedGroups() })

      await page.goto('/admin/liga/1/regulamento')
      await expect(page.locator('[data-test=group-card]')).toHaveCount(2)
      await expect(page.locator('[data-test=tiebreaker-item]')).toHaveCount(6)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      const rightEdges = await page
        .locator('[data-test=tiebreaker-remove], [data-test=group-team-select]')
        .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().right))
      expect(Math.max(...rightEdges)).toBeLessThanOrEqual(viewport.width)
    })
  }
})
