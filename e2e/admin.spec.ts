import type { Page } from '@playwright/test'
import { API_BASE_URL } from './support/env'
import { samplePng, sampleImageUrl } from './support/images'
import { fixture, type MockApi } from './support/mock-api'
import {
  DESKTOP,
  expect,
  MOBILE,
  openDialog,
  openMenu,
  pickOption,
  signIn,
  test,
} from './support/test'

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
    await expect(dialog.locator('[data-test=event-type]')).toContainText('Gol contra')
    await expect(dialog).toContainText('o evento conta para o adversário')
    await expect(dialog.locator('[data-test=event-assist]')).toHaveCount(0)
    await expect(dialog.getByRole('spinbutton', { name: 'Minuto' })).toBeFocused()
    await page.keyboard.type('47')
    await page.keyboard.press('Tab')
    await expect(dialog.locator('[data-test=event-type] input')).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('v')
    await expect(dialog.locator('[data-test=event-team]')).toContainText('Visitante · Ribeirinho')
    await page.keyboard.press('Tab')
    await page.keyboard.type('10')
    await expect(openMenu(page).getByRole('option')).toHaveText(['10 · Gustavo Pires'])
    await page.keyboard.press('Tab')
    await expect(dialog.locator('[data-test=event-player]')).toContainText('10 · Gustavo Pires')
    await dialog.locator('[data-test=form-submit]').click()

    await expect(openDialog(page)).toHaveCount(0)
    expect(posted).toMatchObject({
      game_id: 1,
      team_id: 2,
      player_id: 8,
      type: 'own_goal',
      related_player_id: null,
      minute: 47,
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
  test.use({ reducedMotion: 'reduce' })

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
    const teams = groupsBody().data.groups[0].teams
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

  function unassignedTeams(page: Page) {
    return page.locator('[data-test=groups-unassigned] [data-test=group-team]')
  }

  function teamRow(page: Page, name: string) {
    return page.locator('[data-test=group-team]', { hasText: name })
  }

  function unassignedDrawGroups(): Body<GroupsBody> {
    return groupsBody({
      fixture_mode: 'draw',
      groups_count: 2,
      groups: [
        { group_number: 1, teams: [] },
        { group_number: 2, teams: [] },
      ],
      unassigned: groupsBody().data.groups[0].teams,
    })
  }

  test('card Elenco salva o limite de jogadores e mostra o 422 do back', async ({ page, api }) => {
    const message = 'O time Atlético Serrano tem 32 atletas, acima do limite de 30.'
    const puts: unknown[] = []
    api.allowedConsoleErrors.push(/status of 422/)
    api.on('GET', '/leagues/1', { body: leagueBody({ max_players_per_team: 35 }) })
    api.on('PUT', '/leagues/1', ({ request }) => {
      puts.push(request.postDataJSON())
      return { status: 422, body: { message, errors: { max_players_per_team: [message] } } }
    })
    await signIn(page, { role: 'admin' })
    await page.goto('/admin/liga/1/regulamento')

    const field = page.locator('[data-test=rules-max-players]')
    await expect(field.locator('input')).toHaveValue('35')
    await field.locator('input').fill('9')
    await page.locator('[data-test=rules-submit]').click()
    await expect(field).toContainText('Informe um número inteiro de 11 a 35.')
    expect(puts).toHaveLength(0)

    await field.locator('input').fill('30')
    await page.locator('[data-test=rules-submit]').click()
    await expect(field).toContainText(message)
    await expect(page.locator('[data-test=rules-error]')).toHaveText(message)
    expect(puts[0]).toMatchObject({ max_players_per_team: 30 })
  })

  test('admin configura o sorteio e salva só o regulamento', async ({ page, api }) => {
    await signIn(page, { role: 'admin' })
    let groups = groupsBody()
    let sent: Record<string, unknown> = {}
    api
      .on('GET', '/leagues/1', { body: leagueBody() })
      .on('GET', '/leagues/1/groups', () => ({ body: groups }))
      .on('PUT', '/leagues/1', ({ request }) => {
        sent = request.postDataJSON() as Record<string, unknown>
        groups = unassignedDrawGroups()
        return { body: leagueBody(sent) }
      })

    await page.goto('/admin/liga/1')
    await page.locator('.v-navigation-drawer').getByRole('link', { name: 'Regulamento' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/regulamento$/)
    await expect(page.locator('[data-test=rules-format] input')).toHaveValue('Grupos + mata-mata')
    await expect(page.locator('[data-test=rules-summary]')).toHaveText('4 times → 1 grupo de 4')
    await expect(page.locator('[data-test=rules-groups-count] input')).toBeDisabled()
    await expect(page.locator('[data-test=rules-groups-count]')).toContainText(
      'Na tabela manual, a liga tem um único grupo.',
    )

    await choose(page, 'rules-fixture-mode', 'Sorteio')
    await expect(page.locator('[data-test=rules-groups-count] input')).toBeEnabled()
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
    await expect(page.locator('.v-dialog.v-overlay--active')).toHaveCount(0)
    expect(sent).toEqual({ ...HYBRID_DRAW, max_players_per_team: 35 })
    await expect(unassignedTeams(page)).toHaveCount(4)
  })

  test('admin sorteia os grupos, corrige à mão e salva a montagem', async ({ page, api }) => {
    await signIn(page, { role: 'admin' })
    let assignments: unknown = null
    api
      .on('GET', '/leagues/1', { body: leagueBody(HYBRID_DRAW) })
      .on('GET', '/leagues/1/groups', { body: unassignedDrawGroups() })
      .on('POST', '/leagues/1/groups/shuffle', () => ({ body: assignedGroups() }))
      .on('PUT', '/leagues/1/groups', ({ request }) => {
        assignments = (request.postDataJSON() as { groups: unknown }).groups
        return { body: assignedGroups() }
      })

    await page.goto('/admin/liga/1/regulamento')
    await expect(unassignedTeams(page)).toHaveCount(4)
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

  test('tabela manual fixa um grupo e a conta do mata-mata segue grupos × classificados', async ({
    page,
    api,
  }) => {
    await signIn(page)
    let sent: Record<string, unknown> = {}
    api
      .on('GET', '/leagues/1', { body: leagueBody(HYBRID_DRAW) })
      .on('GET', '/leagues/1/groups', { body: assignedGroups() })
      .on('PUT', '/leagues/1', ({ request }) => {
        sent = request.postDataJSON() as Record<string, unknown>
        return { body: leagueBody(sent) }
      })

    await page.goto('/admin/liga/1/regulamento')
    await choose(page, 'rules-fixture-mode', 'Manual')
    await expect(page.locator('[data-test=rules-groups-count] input')).toBeDisabled()
    await expect(page.locator('[data-test=rules-groups-count]')).toContainText('1')
    await page.locator('[data-test=rules-submit]').click()
    await expect(page.locator('[data-test=rules-knockout-size]')).toContainText(
      'O tamanho do mata-mata deve ser igual a grupos × classificados por grupo (1).',
    )
    expect(sent).toEqual({})

    await choose(page, 'rules-qualifiers', '2')
    await expect(page.locator('[data-test=rules-summary]')).toHaveText(
      '4 times → 1 grupo de 4 → 2 classificados → Final',
    )
    await page.locator('[data-test=rules-submit]').click()
    const dialog = page.locator('.v-dialog.v-overlay--active')
    await expect(dialog).toContainText('a montagem atual dos grupos será apagada')
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Regulamento salvo com sucesso.')).toBeVisible()
    expect(sent).toMatchObject({ fixture_mode: 'manual', groups_count: 1, qualifiers_per_group: 2 })
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

test.describe('Sorteio de rodadas', () => {
  type Body<T = Record<string, unknown>> = { data: T }
  type Team = { id: number; name: string; nickname: string }

  const teams = fixture<Body<Team[]>>('teams').data
  const NOTHING_DRAWN = 'Nenhuma rodada foi sorteada.'

  function drawState(extra: Record<string, unknown> = {}) {
    return {
      league_id: 1,
      format: 'hybrid',
      fixture_mode: 'draw',
      groups_count: 2,
      group_legs: 2,
      group_size: 2,
      rounds_per_turn: 1,
      total_rounds: 2,
      drawn_rounds: 0,
      next_round: 1,
      can_draw: true,
      draw_blocked_reason: null,
      can_undo: false,
      undo_blocked_reason: NOTHING_DRAWN,
      can_reset: false,
      reset_blocked_reason: NOTHING_DRAWN,
      manual_round_games: { total: 0, with_results: 0 },
      groups: [
        { group_number: 1, byes: [] },
        { group_number: 2, byes: [] },
      ],
      ...extra,
    }
  }

  function drawnState(rounds: number) {
    return drawState({
      drawn_rounds: rounds,
      next_round: rounds >= 2 ? null : rounds + 1,
      can_draw: rounds < 2,
      draw_blocked_reason: rounds >= 2 ? 'Todas as rodadas já foram sorteadas.' : null,
      can_undo: rounds > 0,
      undo_blocked_reason: rounds > 0 ? null : NOTHING_DRAWN,
      can_reset: rounds > 0,
      reset_blocked_reason: rounds > 0 ? null : NOTHING_DRAWN,
    })
  }

  function game(id: number, round: number, group: number, home: Team, away: Team) {
    return {
      id,
      league_id: 1,
      home_team_id: home.id,
      away_team_id: away.id,
      stadium_id: null,
      match_date: null,
      home_score: null,
      away_score: null,
      round,
      group_number: group,
      phase: null,
      phase_order: null,
      tie_key: null,
      leg: null,
      status: 'scheduled',
      created_at: '',
      updated_at: '',
      homeTeam: { ...home, logo: null },
      awayTeam: { ...away, logo: null },
      stadium: null,
    }
  }

  function gamesOf(rounds: number) {
    const [serrano, ribeirinho, estrela, uniao] = teams
    const all = [
      game(101, 1, 1, serrano, ribeirinho),
      game(102, 1, 2, estrela, uniao),
      game(103, 2, 1, ribeirinho, serrano),
      game(104, 2, 2, uniao, estrela),
    ]
    return all.filter((item) => item.round <= rounds)
  }

  function page1<T>(data: T[]) {
    return {
      data,
      links: {},
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        per_page: 100,
        to: data.length,
        total: data.length,
      },
    }
  }

  function drawLeagues() {
    const body = fixture<Body<Record<string, unknown>[]>>('leagues')
    return {
      data: body.data.map((league) =>
        league.id === 1
          ? { ...league, format: 'hybrid', fixture_mode: 'draw', groups_count: 2, group_legs: 2 }
          : league,
      ),
    }
  }

  function installDraw(api: MockApi, initial: ReturnType<typeof drawState>) {
    const sent: { method: string; path: string; body: unknown }[] = []
    let state = initial
    api
      .on('GET', '/leagues', { body: drawLeagues() })
      .on('GET', '/leagues/1/draw', () => ({ body: { data: state } }))
      .on('GET', '/games', () => ({ body: page1(gamesOf(state.drawn_rounds)) }))
      .on('POST', '/leagues/1/draw/next-round', ({ request }) => {
        const body = request.postDataJSON() as { round: number }
        sent.push({ method: 'POST', path: 'next-round', body })
        state = drawnState(body.round)
        return { body: { data: state } }
      })
      .on('DELETE', '/leagues/1/draw/last-round', ({ request }) => {
        const body = request.postDataJSON() as { round: number }
        sent.push({ method: 'DELETE', path: 'last-round', body })
        state = drawnState(body.round - 1)
        return { body: { data: state } }
      })
      .on('DELETE', '/leagues/1/draw', ({ request }) => {
        sent.push({ method: 'DELETE', path: 'reset', body: request.postData() })
        state = drawnState(0)
        return { body: { data: state } }
      })
    return sent
  }

  test('admin sorteia o turno com aviso, o returno direto, desfaz e reinicia', async ({
    page,
    api,
  }) => {
    await signIn(page, { role: 'admin' })
    const sent = installDraw(api, drawState())

    await page.goto('/admin/liga/1/partidas')
    await expect(page.locator('[data-test=games-draw-notice]')).toBeVisible()
    await page.locator('.v-navigation-drawer').getByRole('link', { name: 'Sorteio' }).click()
    await expect(page).toHaveURL(/\/admin\/liga\/1\/sorteio$/)
    await expect(page.locator('[data-test=draw-progress-title]')).toHaveText(
      'Nenhuma rodada sorteada',
    )
    await expect(page.locator('[data-test=draw-next-round]')).toHaveText(
      'Próxima: rodada 1 · Turno',
    )

    await page.locator('[data-test=draw-next]').click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=draw-confirm-limits] li')).toHaveCount(5)
    await expect(dialog).toContainText('Não dá para adicionar times à liga.')
    await dialog.locator('[data-test=draw-confirm-submit]').click()

    await expect(page.locator('[data-test=draw-progress-title]')).toHaveText(
      'Rodada 1 de 2 sorteada',
    )
    const round1 = page.locator('[data-test=draw-round]', { hasText: 'Rodada 1' })
    await expect(round1.locator('[data-test=draw-game]')).toHaveCount(2)
    await expect(round1.locator('[data-test=draw-round-group]').first()).toContainText('Grupo A')
    await expect(round1.locator('[data-test=draw-game]').first()).toContainText('Serrano')
    await expect(round1.locator('[data-test=draw-game-date]').first()).toHaveText('Data a definir')
    await expect(round1.locator('[data-test=draw-game]').first()).toHaveAttribute(
      'href',
      '/admin/liga/1/partidas/101',
    )

    await page.locator('[data-test=draw-next]').click()
    await expect(page.locator('[data-test=draw-complete]')).toBeVisible()
    await expect(page.locator('[data-test=draw-round]')).toHaveCount(2)
    await expect(page.locator('[data-test=draw-round]').first()).toContainText('Rodada 2')
    await expect(
      page.locator('[data-test=draw-round]').first().locator('[data-test=draw-round-turn]'),
    ).toHaveText('Returno')
    await expect(page.locator('[data-test=draw-next]')).toBeDisabled()

    await page.locator('[data-test=draw-undo]').click()
    await expect(openDialog(page)).toContainText('As partidas da rodada 2 serão apagadas')
    await openDialog(page).getByRole('button', { name: 'Desfazer', exact: true }).click()
    await expect(page.locator('[data-test=draw-round]')).toHaveCount(1)
    await expect(page.locator('[data-test=draw-next]')).toHaveText('Sortear rodada 2')

    await page.locator('[data-test=draw-reset]').click()
    const reset = openDialog(page)
    await expect(reset.locator('[data-test=draw-reset-confirm]')).toBeDisabled()
    await reset.locator('[data-test=draw-reset-input] input').fill('REINICIAR')
    await reset.locator('[data-test=draw-reset-confirm]').click()
    await expect(page.locator('[data-test=draw-empty]')).toBeVisible()
    await expect(page.locator('[data-test=draw-progress-title]')).toHaveText(
      'Nenhuma rodada sorteada',
    )

    expect(sent).toEqual([
      { method: 'POST', path: 'next-round', body: { round: 1 } },
      { method: 'POST', path: 'next-round', body: { round: 2 } },
      { method: 'DELETE', path: 'last-round', body: { round: 2 } },
      { method: 'DELETE', path: 'reset', body: null },
    ])
  })

  test('partidas manuais: avisa a substituição e envia replace_manual_rounds', async ({
    page,
    api,
  }) => {
    await signIn(page, { role: 'admin' })
    const sent = installDraw(api, drawState({ manual_round_games: { total: 3, with_results: 1 } }))

    await page.goto('/admin/liga/1/sorteio')
    await page.locator('[data-test=draw-next]').click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=draw-confirm-manual]')).toContainText(
      'A liga tem 3 partidas de rodada cadastradas manualmente. Elas serão apagadas antes do sorteio.',
    )
    await expect(dialog.locator('[data-test=draw-confirm-manual-results]')).toContainText(
      '1 delas tem resultado ou eventos, que também serão perdidos.',
    )
    await dialog.getByRole('button', { name: 'Apagar e sortear' }).click()

    await expect(page.locator('[data-test=draw-round]')).toHaveCount(1)
    expect(sent).toEqual([
      { method: 'POST', path: 'next-round', body: { round: 1, replace_manual_rounds: true } },
    ])
  })

  test('liga sem sorteio: sem item no menu e a tela avisa', async ({ page }) => {
    await signIn(page, { role: 'admin' })
    await page.goto('/admin/liga/1/sorteio')
    await expect(page.locator('[data-test=draw-not-enabled]')).toBeVisible()
    await expect(
      page.locator('.v-navigation-drawer').getByRole('link', { name: 'Sorteio' }),
    ).toHaveCount(0)
  })

  for (const [name, viewport] of [
    ['mobile', MOBILE],
    ['desktop', DESKTOP],
  ] as const) {
    test(`${name}: rodadas e botões sem rolagem horizontal`, async ({ page, api }) => {
      await page.setViewportSize(viewport)
      await signIn(page)
      installDraw(api, drawnState(1))

      await page.goto('/admin/liga/1/sorteio')
      await expect(page.locator('[data-test=draw-game]')).toHaveCount(2)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      const rightEdges = await page
        .locator('[data-test=draw-next], [data-test=draw-reset], [data-test=draw-game]')
        .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().right))
      expect(Math.max(...rightEdges)).toBeLessThanOrEqual(viewport.width)
    })
  }
})

test.describe('Tabela por grupo', () => {
  type Row = Record<string, unknown> & { team_id: number }
  type TableBody = { data: { standings: Row[] } }

  const rows = fixture<TableBody>('league-1-table').data.standings

  function groupedTable() {
    const [estrela, serrano, uniao, ribeirinho] = rows
    const groupA = [estrela, serrano]
    const groupB = [
      { ...uniao, tied: true },
      { ...ribeirinho, tied: true },
    ]
    return {
      data: {
        standings: [estrela, serrano, ...groupB],
        groups: [
          { group_number: 1, standings: groupA },
          { group_number: 2, standings: groupB },
        ],
        tiebreakers: ['points', 'head_to_head', 'goals_against', 'fewer_red_cards'],
        phases: [],
      },
    }
  }

  function groupLeagues() {
    const body = fixture<{ data: Record<string, unknown>[] }>('leagues')
    return {
      data: body.data.map((league) =>
        league.id === 1
          ? {
              ...league,
              format: 'hybrid',
              fixture_mode: 'draw',
              groups_count: 2,
              qualifiers_per_group: 1,
            }
          : league,
      ),
    }
  }

  for (const [name, viewport] of [
    ['mobile', MOBILE],
    ['desktop', DESKTOP],
  ] as const) {
    test(`${name}: uma tabela por grupo, classificados, empate técnico e legenda`, async ({
      page,
      api,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page)
      api
        .on('GET', '/leagues', { body: groupLeagues() })
        .on('GET', '/leagues/1/table', { body: groupedTable() })

      await page.goto('/admin/liga/1/tabela')
      const groups = page.locator('[data-test=standings-group]')
      await expect(groups).toHaveCount(2)
      await expect(groups.locator('[data-test=standings-title]')).toHaveText(['Grupo A', 'Grupo B'])
      await expect(groups.nth(0).locator('[data-test=standings-row]')).toHaveCount(2)
      await expect(groups.nth(0).locator('[data-test=standings-qualified]')).toHaveCount(1)
      await expect(groups.nth(1).locator('[data-test=standings-qualified]')).toHaveCount(1)
      await expect(groups.nth(0).locator('[data-test=standings-tied]')).toHaveCount(0)
      await expect(groups.nth(1).locator('[data-test=standings-tied]')).toHaveCount(2)

      const legend = page.locator('[data-test=standings-legend]')
      await expect(legend).toHaveCount(1)
      await expect(legend.locator('[data-test=standings-tiebreakers]')).toHaveText(
        'Desempate: confronto direto, menos gols sofridos e menos cartões vermelhos.',
      )
      await expect(legend.locator('[data-test=standings-legend-qualified]')).toHaveText(
        'Classifica-se o 1º colocado de cada grupo para o mata-mata.',
      )
      await expect(legend.locator('[data-test=standings-legend-tied]')).toHaveText(
        'Empate técnico: ordem alfabética.',
      )

      await groups.nth(1).locator('[data-test=standings-tied]').first().focus()
      await expect(page.locator('.v-tooltip.v-overlay--active > .v-overlay__content')).toHaveText(
        'Empate técnico: ordem alfabética',
      )

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      const rightEdges = await groups
        .locator('[data-test=standings-row]')
        .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().right))
      expect(Math.max(...rightEdges)).toBeLessThanOrEqual(viewport.width)
    })
  }
})

test.describe('Mata-mata gerado pela classificação', () => {
  type Body<T = Record<string, unknown>> = { data: T }
  type Team = { id: number; name: string; nickname: string }

  const [serrano, ribeirinho, estrela, uniao] = fixture<Body<Team[]>>('teams').data
  const short = (team: Team) => ({ ...team, logo: null })

  function knockoutLeagues() {
    const body = fixture<Body<Record<string, unknown>[]>>('leagues')
    return {
      data: body.data.map((league) =>
        league.id === 1
          ? {
              ...league,
              format: 'hybrid',
              fixture_mode: 'draw',
              groups_count: 2,
              group_legs: 1,
              qualifiers_per_group: 2,
              knockout_size: 4,
              knockout_legs: 1,
              final_legs: 1,
              third_place: true,
              knockout_tiebreakers: ['penalties'],
            }
          : league,
      ),
    }
  }

  const drawDone = {
    league_id: 1,
    format: 'hybrid',
    fixture_mode: 'draw',
    groups_count: 2,
    group_legs: 1,
    group_size: 2,
    rounds_per_turn: 1,
    total_rounds: 1,
    drawn_rounds: 1,
    next_round: null,
    can_draw: false,
    draw_blocked_reason: 'Todas as rodadas já foram sorteadas.',
    can_undo: false,
    undo_blocked_reason: 'O mata-mata já foi gerado; desfaça as fases do mata-mata antes.',
    can_reset: false,
    reset_blocked_reason: 'O mata-mata já foi gerado; desfaça as fases do mata-mata antes.',
    manual_round_games: { total: 0, with_results: 0 },
    groups: [
      { group_number: 1, byes: [] },
      { group_number: 2, byes: [] },
    ],
  }

  function knockoutState(generated: boolean, extra: Record<string, unknown> = {}) {
    return {
      league_id: 1,
      enabled: true,
      knockout_size: 4,
      knockout_legs: 1,
      final_legs: 1,
      third_place: true,
      knockout_tiebreakers: ['penalties'],
      stages: [
        { key: 'SF', label: 'Semifinal', legs: 1, generated },
        { key: '3P', label: 'Disputa de 3º lugar', legs: 1, generated: false },
        { key: 'F', label: 'Final', legs: 1, generated: false },
      ],
      generated_stages: generated ? ['SF'] : [],
      last_stage: generated ? 'SF' : null,
      next_stage: generated
        ? { key: 'F', label: 'Final', legs: 1, with_third_place: true }
        : { key: 'SF', label: 'Semifinal', legs: 1, with_third_place: false },
      can_generate: !generated,
      generate_blocked_reason: generated
        ? 'Há confrontos das semifinais ainda não decididos.'
        : null,
      can_undo: generated,
      undo_blocked_reason: generated ? null : 'Nenhuma fase do mata-mata foi gerada.',
      manual_phase_games: { total: 0, with_results: 0 },
      awaiting_penalties: [],
      cancelled_group_games: 0,
      ...extra,
    }
  }

  const previewTie = (key: string, home: Team, away: Team, labels: [string, string]) => ({
    tie_key: key,
    home_team: short(home),
    away_team: short(away),
    home_label: labels[0],
    away_label: labels[1],
    legs: [{ leg: null, home_team_id: home.id, away_team_id: away.id }],
  })

  const preview = {
    stage: { key: 'SF', label: 'Semifinal', legs: 1 },
    ties: [
      previewTie('SF-1', estrela, ribeirinho, ['1º Grupo A', '2º Grupo B']),
      previewTie('SF-2', uniao, serrano, ['1º Grupo B', '2º Grupo A']),
    ],
    third_place: null,
  }

  const tie = (key: string, id: number, home: Team, away: Team) => ({
    tie_key: key,
    decided: false,
    winner_team_id: null,
    decided_by: null,
    awaiting_penalties: false,
    decisive_game_id: id,
    home_penalties: null,
    away_penalties: null,
    teams: [home, away].map((team) => ({
      team_id: team.id,
      name: team.name,
      nickname: team.nickname,
      aggregate_score: 0,
    })),
    legs: [
      {
        id,
        leg: null,
        home_team_id: home.id,
        away_team_id: away.id,
        home_score: null,
        away_score: null,
        home_penalties: null,
        away_penalties: null,
        status: 'scheduled',
        match_date: null,
      },
    ],
  })

  const semifinals = {
    phase: 'Semifinal',
    phase_order: 3,
    stage: 'SF',
    ties: [tie('SF-1', 201, estrela, ribeirinho), tie('SF-2', 202, uniao, serrano)],
  }

  function installKnockout(api: MockApi, initial: ReturnType<typeof knockoutState>) {
    const sent: { method: string; body: unknown }[] = []
    let state = initial
    api
      .on('GET', '/leagues', { body: knockoutLeagues() })
      .on('GET', '/leagues/1/draw', { body: { data: drawDone } })
      .on('GET', '/games', {
        body: {
          data: [],
          links: {},
          meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
        },
      })
      .on('GET', '/leagues/1/knockout', () => ({ body: { data: state } }))
      .on('GET', '/leagues/1/knockout/preview', { body: { data: preview } })
      .on('GET', '/leagues/1/table', () => ({
        body: {
          data: {
            standings: [],
            groups: [],
            tiebreakers: [],
            phases: state.last_stage ? [semifinals] : [],
          },
        },
      }))
      .on('POST', '/leagues/1/knockout/next-stage', ({ request }) => {
        sent.push({ method: 'POST', body: request.postDataJSON() })
        state = knockoutState(true)
        return { body: { data: state } }
      })
      .on('DELETE', '/leagues/1/knockout/last-stage', ({ request }) => {
        sent.push({ method: 'DELETE', body: request.postDataJSON() })
        state = knockoutState(false)
        return { body: { data: state } }
      })
    return sent
  }

  test('admin gera as semifinais pelo preview e desfaz', async ({ page, api }) => {
    await signIn(page, { role: 'admin' })
    const sent = installKnockout(api, knockoutState(false))

    await page.goto('/admin/liga/1/sorteio')
    await page.getByRole('tab', { name: 'Mata-mata' }).click()
    await expect(page).toHaveURL(/tab=mata-mata/)
    await expect(page.locator('[data-test=knockout-stage]')).toHaveText([
      'Semifinal (pendente)',
      'Disputa de 3º lugar (pendente)',
      'Final (pendente)',
    ])
    await expect(page.locator('[data-test=knockout-next]')).toHaveText(
      'Próxima: Semifinal · Jogo único',
    )
    await expect(page.locator('[data-test=knockout-future-tie]').first()).toContainText(
      '1º Grupo A',
    )

    await page.locator('[data-test=knockout-generate]').click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=knockout-dialog-labels]')).toHaveText([
      '1º Grupo A × 2º Grupo B',
      '1º Grupo B × 2º Grupo A',
    ])
    await expect(dialog.locator('[data-test=knockout-dialog-leg]').first()).toHaveText(
      'Jogo único: Estrela × Ribeirinho',
    )
    await expect(dialog.locator('[data-test=knockout-dialog-manual]')).toHaveCount(0)
    await expect(dialog.locator('[data-test=knockout-dialog-lock]')).toHaveText(
      'Depois de gerar, os resultados da fase de grupos não poderão mais ser alterados, inclusive partidas canceladas.',
    )
    await dialog.getByRole('button', { name: 'Confirmar e gerar' }).click()

    await expect(page.locator('[data-test=knockout-tie]')).toHaveCount(2)
    await expect(page.locator('[data-test=knockout-leg]').first()).toHaveAttribute(
      'href',
      '/admin/liga/1/partidas/201',
    )
    await expect(page.locator('[data-test=knockout-blocked]')).toHaveText(
      'Há confrontos das semifinais ainda não decididos.',
    )
    const future = page.locator('[data-test=knockout-future-tie]')
    await expect(future).toHaveCount(2)
    await expect(future.nth(0)).toContainText('Perdedor SF-1')
    await expect(future.nth(1)).toContainText('Vencedor SF-1')

    await page.locator('[data-test=knockout-undo]').click()
    await expect(openDialog(page)).toContainText(
      'As partidas das semifinais serão apagadas. Os resultados da fase de grupos voltarão a poder ser corrigidos.',
    )
    await openDialog(page).getByRole('button', { name: 'Desfazer', exact: true }).click()
    await expect(page.locator('[data-test=knockout-tie]')).toHaveCount(0)
    await expect(page.locator('[data-test=knockout-generate]')).toHaveText('Gerar semifinal')

    expect(sent).toEqual([
      { method: 'POST', body: { stage: 'SF' } },
      { method: 'DELETE', body: { stage: 'SF' } },
    ])
  })

  test('partidas de fase manuais: avisa a substituição e envia replace_manual_phases', async ({
    page,
    api,
  }) => {
    await signIn(page, { role: 'admin' })
    const sent = installKnockout(
      api,
      knockoutState(false, {
        manual_phase_games: { total: 2, with_results: 1 },
        cancelled_group_games: 2,
      }),
    )

    await page.goto('/admin/liga/1/sorteio?tab=mata-mata')
    await page.locator('[data-test=knockout-generate]').click()
    const dialog = openDialog(page)
    await expect(dialog.locator('[data-test=knockout-dialog-manual]')).toHaveText(
      'A liga tem 2 partidas de mata-mata cadastradas manualmente. Elas serão apagadas antes de gerar o mata-mata.',
    )
    await expect(dialog.locator('[data-test=knockout-dialog-manual-results]')).toContainText(
      '1 delas tem resultado ou eventos, que também serão perdidos.',
    )
    await expect(dialog.locator('[data-test=knockout-dialog-cancelled]')).toHaveText(
      'Há 2 partidas canceladas que ficarão sem resultado.',
    )
    await expect(dialog.locator('[data-test=knockout-dialog-tie]')).toHaveCount(2)
    await dialog.getByRole('button', { name: 'Apagar e gerar' }).click()

    await expect(page.locator('[data-test=knockout-tie]')).toHaveCount(2)
    expect(sent).toEqual([{ method: 'POST', body: { stage: 'SF', replace_manual_phases: true } }])
  })

  test('jogo de grupo travado pelo mata-mata: súmula só corrige jogador e minuto e o formulário trava resultado', async ({
    page,
    api,
  }) => {
    await signIn(page, { role: 'admin' })
    const base = fixture<Body<Record<string, unknown>>>('game-1').data
    const locked = { ...base, group_number: 1, results_locked: true }
    let eventPut: Record<string, unknown> = {}
    let gamePut: Record<string, unknown> = {}
    api
      .on('GET', '/leagues', { body: knockoutLeagues() })
      .on('GET', '/games/1', { body: { data: locked } })
      .on('PUT', '/game-events/4', ({ request }) => {
        eventPut = request.postDataJSON() as Record<string, unknown>
        return { body: { data: { id: 4, ...eventPut } } }
      })
      .on('PUT', '/games/1', ({ request }) => {
        gamePut = request.postDataJSON() as Record<string, unknown>
        return { body: { data: { ...locked, ...gamePut } } }
      })

    await page.goto('/admin/liga/1/partidas/1?tab=sumula')
    await expect(page.locator('[data-test=event-row]')).toHaveCount(4)
    await expect(page.locator('[data-test=events-locked]')).toHaveText(
      'Os resultados da fase de grupos estão travados porque o mata-mata já foi gerado. Para corrigir, desfaça o mata-mata. Ainda dá para corrigir o jogador e o minuto dos eventos lançados.',
    )
    await expect(page.locator('[data-test=event-actions]')).toHaveCount(0)
    await expect(page.locator('[data-test=event-delete]')).toHaveCount(0)
    await expect(page.locator('[data-test=event-edit]')).toHaveCount(4)

    await page.locator('[data-test=event-edit]').first().click()
    const eventDialog = openDialog(page)
    await expect(eventDialog.locator('[data-test=event-type]')).toHaveClass(/v-input--disabled/)
    await expect(eventDialog.locator('[data-test=event-team]')).toHaveClass(/v-input--disabled/)
    await expect(eventDialog.locator('[data-test=event-player]')).not.toHaveClass(
      /v-input--disabled/,
    )
    await eventDialog.getByRole('spinbutton', { name: 'Minuto' }).fill('80')
    await eventDialog.locator('[data-test=form-submit]').click()
    await expect(openDialog(page)).toHaveCount(0)
    expect(eventPut).toMatchObject({ team_id: 1, type: 'goal', player_id: 5, minute: 80 })

    await page.locator('[data-test=game-edit]').click()
    const gameDialog = openDialog(page)
    await expect(gameDialog.locator('[data-test=game-locked-notice]')).toHaveText(
      'Mata-mata já gerado: o resultado desta partida está travado. Dá para mudar só data e estádio; para corrigir o resultado, desfaça o mata-mata.',
    )
    await expect(gameDialog.locator('[data-test=game-drawn-notice]')).toHaveCount(0)
    await expect(gameDialog.locator('[data-test=game-swap-teams]')).toHaveCount(0)
    for (const field of ['game-status', 'game-home-team', 'game-away-team']) {
      await expect(gameDialog.locator(`[data-test=${field}]`)).toHaveClass(/v-input--disabled/)
    }
    await expect(gameDialog.locator('[data-test=game-match-date]')).not.toHaveClass(
      /v-input--disabled/,
    )
    await gameDialog.locator('[data-test=form-submit]').click()
    await expect(openDialog(page)).toHaveCount(0)
    expect(gamePut).toMatchObject({
      status: 'finished',
      home_team_id: 1,
      away_team_id: 2,
      round: 1,
    })
  })

  test('pênaltis na súmula: cobranças vão para o endpoint próprio e o placar vem da resposta', async ({
    page,
    api,
  }) => {
    await signIn(page, { role: 'admin' })
    const base = fixture<Body<Record<string, unknown>>>('game-1').data
    const decisive = {
      ...base,
      home_score: 1,
      away_score: 1,
      round: null,
      group_number: null,
      phase: 'Semifinal',
      phase_order: 3,
      tie_key: 'SF-1',
      leg: null,
      knockout_stage: 'SF',
      penalties_allowed: true,
      home_penalties: null,
      away_penalties: null,
      events: [],
    }
    const puts: string[] = []
    let kicks: unknown = null
    api
      .on('GET', '/leagues', { body: knockoutLeagues() })
      .on('GET', '/games/1', { body: { data: decisive } })
      .on('PUT', '/games/1', ({ request }) => {
        puts.push(request.url())
        return { body: { data: decisive } }
      })
      .on('PUT', '/games/1/penalty-kicks', ({ request }) => {
        kicks = request.postDataJSON()
        return {
          body: { data: { ...decisive, home_penalties: 3, away_penalties: 0, penaltyKicks: [] } },
        }
      })

    await page.goto('/admin/liga/1/partidas/1?tab=sumula')
    await expect(page.locator('[data-test=game-score]')).toHaveText('1 × 1')
    await expect(page.locator('[data-test=game-delete]')).toBeDisabled()
    const card = page.locator('[data-test=game-penalties]')
    await card.getByRole('radio', { name: 'Ribeirinho (visitante)' }).check()
    const shootout: [number, 'scored' | 'missed'][] = [
      [9, 'scored'],
      [1, 'missed'],
      [10, 'scored'],
      [4, 'missed'],
      [1, 'scored'],
    ]
    for (const [index, [number, result]] of shootout.entries()) {
      await card.locator(`[data-test=kick-player-${index}]`).click()
      await page.keyboard.type(String(number))
      await page.keyboard.press('Enter')
      await card
        .locator('[data-test=kick-row]')
        .nth(index)
        .locator(`[data-test=kick-${result}]`)
        .click()
    }
    await expect(card.locator('[data-test=kick-repeated]')).toHaveCount(0)
    await expect(card.locator('[data-test=kick-row]')).toHaveCount(6)
    await expect(card.getByRole('button', { name: 'Salvar disputa' })).toBeDisabled()
    await card.locator('[data-test=kick-player-5]').click()
    await page.keyboard.type('8')
    await page.keyboard.press('Enter')
    await card.locator('[data-test=kick-row]').nth(5).locator('[data-test=kick-missed]').click()
    await expect(card.locator('[data-test=shootout-result]')).toHaveText(
      'Disputa decidida: 0 × 3, Ribeirinho vence',
    )
    await card.getByRole('button', { name: 'Salvar disputa' }).click()

    await expect(page.locator('[data-test=game-score]')).toHaveText('1 (3) × (0) 1')
    expect(puts).toEqual([])
    expect(kicks).toEqual({
      kicks: [
        { team_id: 2, player_id: 7, scored: true },
        { team_id: 1, player_id: 1, scored: false },
        { team_id: 2, player_id: 8, scored: true },
        { team_id: 1, player_id: 2, scored: false },
        { team_id: 2, player_id: 6, scored: true },
        { team_id: 1, player_id: 3, scored: false },
      ],
    })
  })

  for (const [name, viewport] of [
    ['mobile', MOBILE],
    ['desktop', DESKTOP],
  ] as const) {
    test(`${name}: mata-mata, preview e placar com pênaltis sem rolagem horizontal`, async ({
      page,
      api,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page)
      installKnockout(api, knockoutState(false))
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
      const maxRight = (selector: string) =>
        page
          .locator(selector)
          .evaluateAll((elements) =>
            Math.max(...elements.map((el) => el.getBoundingClientRect().right)),
          )

      await page.goto('/admin/liga/1/sorteio?tab=mata-mata')
      await expect(page.locator('[data-test=knockout-future-tie]')).toHaveCount(4)
      expect(await overflow()).toBeLessThanOrEqual(0)
      expect(
        await maxRight(
          '[data-test=knockout-generate], [data-test=knockout-future-tie], [data-test=knockout-stage]',
        ),
      ).toBeLessThanOrEqual(viewport.width)

      await page.locator('[data-test=knockout-generate]').click()
      await expect(openDialog(page).locator('[data-test=knockout-dialog-tie]')).toHaveCount(2)
      expect(
        await maxRight('.v-dialog.v-overlay--active [data-test=knockout-dialog-tie]'),
      ).toBeLessThanOrEqual(viewport.width)

      const game = fixture<Body<Record<string, unknown>>>('game-1').data
      api.on('GET', '/games/1', {
        body: {
          data: {
            ...game,
            home_score: 10,
            away_score: 10,
            home_penalties: 12,
            away_penalties: 11,
            round: null,
            phase: 'Final',
            phase_order: 5,
            tie_key: 'F-1',
            knockout_stage: 'F',
            penalties_allowed: true,
            events: [],
          },
        },
      })
      await page.goto('/admin/liga/1/partidas/1?tab=sumula')
      await expect(page.locator('[data-test=game-score]')).toHaveText('10 (12) × (11) 10')
      await expect(page.locator('[data-test=game-penalties]')).toBeVisible()
      expect(await overflow()).toBeLessThanOrEqual(0)
      expect(
        await maxRight('[data-test=game-header] .scoreboard > *, [data-test=game-penalties]'),
      ).toBeLessThanOrEqual(viewport.width)
    })
  }
})
