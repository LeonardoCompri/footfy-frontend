import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PlayerDetailView from '@/views/admin/players/PlayerDetailView.vue'
import { playersService } from '@/services/api/players.service'
import { teamsService } from '@/services/api/teams.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import type { GameEvent } from '@/types/gameEvent'
import { createTestRouter, createTestVuetify, makeUser, setupLeagueSession } from '@/test/utils'
import { makePlayer, makeTeam, POSITIONS } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { get: vi.fn() } }))
vi.mock('@/services/api/players.service', () => ({
  playersService: { get: vi.fn(), positions: vi.fn(), remove: vi.fn(), update: vi.fn(), create: vi.fn() },
}))
vi.mock('@/services/api/gameEvents.service', () => ({ gameEventsService: { list: vi.fn() } }))

const player = makePlayer(10, 'Fulano da Silva', {
  team_id: 5,
  position: 'ATA',
  number: 9,
  birth_date: '2000-03-15',
  document: '12345678901',
})

function event(id: number, type: GameEvent['type'], playerId: number, leagueId = 1, related: number | null = null): GameEvent {
  return {
    id,
    game_id: id,
    team_id: 5,
    player_id: playerId,
    related_player_id: related,
    league_id: leagueId,
    type,
    minute: 10,
    created_at: '',
    updated_at: '',
  }
}

async function mountDetail(permissions: string[], query = '') {
  setupLeagueSession(makeUser('coach', permissions))
  const router = createTestRouter()
  await router.push(`/admin/liga/1/times/5/jogadores/10${query}`)
  const wrapper = mount(PlayerDetailView, {
    props: { teamId: '5', id: '10' },
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('PlayerDetailView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(playersService.get).mockResolvedValue(player)
    vi.mocked(playersService.positions).mockResolvedValue(POSITIONS)
    vi.mocked(teamsService.get).mockResolvedValue(makeTeam(5, 'Vitória FC'))
  })

  it('é uma tela própria com abas Perfil | Estatísticas e mostra o perfil do jogador', async () => {
    const { wrapper } = await mountDetail([])

    expect(playersService.get).toHaveBeenCalledWith('10')
    expect(wrapper.find('[data-test="player-title"]').text()).toBe('Fulano da Silva')
    expect(wrapper.find('[data-test="back-to-team"]').text()).toContain('Vitória FC')
    expect(wrapper.findAll('.v-tab').map((t) => t.text())).toEqual(['Perfil', 'Estatísticas'])

    const profile = wrapper.find('[data-test="player-profile"]').text()
    expect(profile).toContain('Vitória FC')
    expect(profile).toContain('Atacante')
    expect(profile).toContain('15/03/2000')
    expect(profile).toContain('123.456.789-01')
    expect(profile).not.toContain('12345678901')
  })

  it('perfil mostra "—" no CPF quando o jogador não tem documento', async () => {
    vi.mocked(playersService.get).mockResolvedValue({ ...player, document: null })
    const { wrapper } = await mountDetail([])

    const cpf = wrapper
      .findAll('[data-test="player-profile"] .v-list-item')
      .find((item) => item.text().includes('CPF'))
    expect(cpf?.find('.v-list-item-title').text()).toBe('—')
  })

  it('estatísticas contam gols, assistências e cartões apenas da liga ativa', async () => {
    vi.mocked(gameEventsService.list).mockResolvedValue([
      event(1, 'goal', 10),
      event(2, 'goal', 10),
      event(3, 'goal', 99, 1, 10),
      event(4, 'yellow_card', 10),
      event(5, 'goal', 10, 2), // outra liga
      event(6, 'red_card', 99),
    ])
    const { wrapper } = await mountDetail([], '?tab=estatisticas')

    const tiles = wrapper.findAll('[data-test="player-stats"] .v-card').map((c) => c.text())
    expect(tiles).toEqual(['2Gols', '1Assistências', '1Cartões amarelos', '0Cartões vermelhos'])
  })

  it.each([
    [[] as string[], false, false],
    [['player:update'], true, false],
    [['player:update', 'player:delete'], true, true],
    [['player:all'], true, true],
  ])('permissões %j: editar=%s excluir=%s', async (permissions, canEdit, canDelete) => {
    const { wrapper } = await mountDetail(permissions)
    expect(wrapper.find('[data-test="player-edit"]').exists()).toBe(canEdit)
    expect(wrapper.find('[data-test="player-delete"]').exists()).toBe(canDelete)
  })

  it('editar abre o dialog sem campo de time e atualiza a tela com o retorno', async () => {
    vi.mocked(playersService.update).mockResolvedValue({ ...player, name: 'Fulano Editado' })
    const { wrapper } = await mountDetail(['player:update'])

    await wrapper.find('[data-test="player-edit"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Editar jogador')
    expect(document.body.textContent).not.toContain('Time*')

    const submit = document.querySelector('[data-test="form-submit"]') as HTMLButtonElement
    submit.click()
    await flushPromises()

    expect(playersService.update).toHaveBeenCalledWith(10, expect.objectContaining({ team_id: 5 }))
    expect(wrapper.find('[data-test="player-title"]').text()).toBe('Fulano Editado')
  })

  it('remover do elenco confirma (estatísticas mantidas) e volta para o time', async () => {
    vi.mocked(playersService.remove).mockResolvedValue({} as never)
    const { wrapper, router } = await mountDetail(['player:delete'])

    expect(wrapper.find('[data-test="player-delete"]').text()).toBe('Remover')
    await wrapper.find('[data-test="player-delete"]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('.v-overlay--active') as HTMLElement
    expect(dialog.querySelector('.v-card-title')?.textContent).toBe('Remover do elenco')
    expect(dialog.querySelector('.v-card-text')?.textContent).toBe(
      "Remover 'Fulano da Silva' do elenco (as estatísticas são mantidas).",
    )
    const confirm = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Remover',
    ) as HTMLButtonElement
    confirm.click()
    await flushPromises()

    expect(playersService.remove).toHaveBeenCalledWith(10)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('admin-teams-detail'))
    expect(router.currentRoute.value.params).toMatchObject({ teamId: '5' })
  })
})
