import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameAdminListView from '@/views/admin/games/GameAdminListView.vue'
import { gamesService } from '@/services/api/games.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import { teamsService } from '@/services/api/teams.service'
import type { LeagueFormat } from '@/types/championship'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError, makeGame, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { list: vi.fn() } }))
vi.mock('@/services/api/stadiums.service', () => ({ stadiumsService: { list: vi.fn() } }))

const ALL = ['game:read', 'game:create', 'game:update', 'game:delete']

const games = [
  makeGame(2, { league_id: 7, round: 2, home_team_id: 2, away_team_id: 1, match_date: '2026-04-12 16:00:00' }),
  makeGame(1, {
    league_id: 7,
    round: 1,
    home_team_id: 1,
    away_team_id: 2,
    home_score: 2,
    away_score: 1,
    status: 'finished',
    match_date: '2026-04-05 16:00:00',
  }),
  makeGame(3, { league_id: 7, round: null, phase: 'Final', phase_order: 3, tie_key: 'F', leg: 1, home_team_id: 1, away_team_id: 2 }),
]

async function mountList(permissions: string[] = ALL, format: LeagueFormat = 'round_robin') {
  setupLeagueSession(makeUser('admin', permissions), [makeLeague(7, championshipA, { format })])
  const router = createTestRouter()
  await router.push('/admin/liga/7/partidas')
  const wrapper = mount(GameAdminListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

function field(wrapper: VueWrapper, name: string, test: string) {
  const found = wrapper.findAllComponents({ name }).find((c) => c.attributes('data-test') === test)
  if (!found) throw new Error(`${name}[data-test=${test}] não encontrado`)
  return found
}

async function choose(wrapper: VueWrapper, name: string, test: string, value: unknown) {
  field(wrapper, name, test).vm.$emit('update:modelValue', value)
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

async function openCreate(wrapper: VueWrapper) {
  await wrapper.find('[data-test="game-create"]').trigger('click')
  await flushPromises()
}

describe('GameAdminListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.innerWidth = 1366
    vi.mocked(gamesService.list).mockResolvedValue(games)
    vi.mocked(teamsService.list).mockResolvedValue([
      makeTeam(1, 'Esporte Clube Vitória', { nickname: 'Vitória' }),
      makeTeam(2, 'Esporte Clube Bahia', { nickname: 'Bahia' }),
    ])
    vi.mocked(stadiumsService.list).mockResolvedValue([])
  })

  it('lista as partidas da liga ativa em ordem de calendário, sem coluna de campeonato', async () => {
    const { wrapper } = await mountList()

    expect(gamesService.list).toHaveBeenCalledWith({ league_id: 7 })
    expect(teamsService.list).toHaveBeenCalledWith({ league_id: 7 })
    const headers = wrapper.findAll('[data-test="games-table"] thead th').map((th) => th.text())
    expect(headers).toEqual(['Etapa', 'Confronto', 'Placar', 'Data', 'Status', ''])
    const rows = wrapper.findAll('[data-test="games-table"] tbody tr').map((tr) => tr.text())
    expect(rows[0]).toContain('1ª rodada')
    expect(rows[0]).toContain('Vitória × Bahia')
    expect(rows[0]).toContain('2 × 1')
    expect(rows[0]).toContain('05/04/2026 16:00')
    expect(rows[0]).toContain('Finalizada')
    expect(rows[1]).toContain('2ª rodada')
    expect(rows[2]).toContain('Final · Ida')
  })

  it('filtra por rodada/fase', async () => {
    const { wrapper } = await mountList()
    await choose(wrapper, 'VSelect', 'game-stage-filter', 'Final')

    const rows = wrapper.findAll('[data-test="games-table"] tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Final')
  })

  it('clicar na linha abre o detalhe da partida', async () => {
    const { wrapper, router } = await mountList()
    await wrapper.find('[data-test="games-table"] tbody tr').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-games-detail'))
    expect(router.currentRoute.value.params.id).toBe('1')
  })

  it.each([
    ['só leitura', ['game:read'], [false, false, false]],
    ['admin do seeder', ALL, [true, true, true]],
    ['game:all', ['game:all'], [true, true, true]],
  ])('ações por permissão: %s', async (_label, permissions, [create, edit, del]) => {
    const { wrapper } = await mountList(permissions)
    expect(wrapper.find('[data-test="game-create"]').exists()).toBe(create)
    expect(wrapper.find('[data-test="game-edit"]').exists()).toBe(edit)
    expect(wrapper.find('[data-test="game-delete"]').exists()).toBe(del)
  })

  it('pontos corridos: form pede Rodada e envia league_id da liga ativa', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9, { league_id: 7 }))
    const { wrapper, router } = await mountList()
    await openCreate(wrapper)

    expect(document.querySelector('[data-test="game-round"]')).not.toBeNull()
    expect(document.querySelector('[data-test="game-phase"]')).toBeNull()
    expect(document.querySelector('[data-test="game-stage-toggle"]')).toBeNull()
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await choose(wrapper, 'VTextField', 'game-round', '3')
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith({
      league_id: 7,
      home_team_id: 1,
      away_team_id: 2,
      stadium_id: null,
      match_date: null,
      status: 'scheduled',
      home_score: null,
      away_score: null,
      round: 3,
      phase: null,
      phase_order: null,
      tie_key: null,
      leg: null,
    })
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe('9'))
  })

  it('mata-mata: form pede Fase + Confronto + perna (sem Rodada)', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    const { wrapper } = await mountList(ALL, 'knockout')
    await openCreate(wrapper)

    expect(document.querySelector('[data-test="game-round"]')).toBeNull()
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    // Fase já usada na liga reaproveita a ordem dela.
    await choose(wrapper, 'VCombobox', 'game-phase', 'Final')
    await choose(wrapper, 'VTextField', 'game-tie-key', 'F')
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ round: null, phase: 'Final', phase_order: 3, tie_key: 'F', leg: null }),
    )
  })

  it('híbrido: alterna entre Rodada e Fase e nunca envia os dois', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    const { wrapper } = await mountList(ALL, 'hybrid')
    await openCreate(wrapper)

    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await choose(wrapper, 'VTextField', 'game-round', '4')
    await choose(wrapper, 'VBtnToggle', 'game-stage-toggle', 'phase')
    await choose(wrapper, 'VCombobox', 'game-phase', 'Semifinal')
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith(expect.objectContaining({ round: null, phase: 'Semifinal' }))
  })

  it('bloqueia mandante igual ao visitante e mostra erros 422 do backend', async () => {
    vi.mocked(gamesService.create).mockRejectedValue(
      apiError(422, 'Dados inválidos.', { phase: ['Informe a Fase desta partida (liga mata-mata).'] }),
    )
    const { wrapper } = await mountList(ALL, 'knockout')
    await openCreate(wrapper)

    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 1)
    await submit()
    expect(gamesService.create).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('O visitante deve ser diferente do mandante.')

    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await submit()
    expect(document.body.textContent).toContain('Informe a Fase desta partida (liga mata-mata).')
  })

  it('edita pela lista com o formulário preenchido', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(games[1])
    const { wrapper } = await mountList()
    await wrapper.findAll('[data-test="game-edit"]')[0].trigger('click')
    await flushPromises()

    expect(field(wrapper, 'VAutocomplete', 'game-home-team').props('modelValue')).toBe(1)
    expect(field(wrapper, 'VTextField', 'game-round').props('modelValue')).toBe(1)
    await submit()

    expect(gamesService.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ league_id: 7, round: 1, home_score: 2, match_date: '2026-04-05T16:00' }),
    )
    expect(gamesService.list).toHaveBeenCalledTimes(2)
  })
})
