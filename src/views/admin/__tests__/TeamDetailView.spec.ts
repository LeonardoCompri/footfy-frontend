import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamDetailView from '@/views/admin/teams/TeamDetailView.vue'
import { teamsService } from '@/services/api/teams.service'
import { playersService } from '@/services/api/players.service'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import { gamesService } from '@/services/api/games.service'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { useSnackbar } from '@/composables/useSnackbar'
import type { Game } from '@/types/game'
import type { GameEvent } from '@/types/gameEvent'
import {
  championshipA,
  championshipB,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError, makeGame, makeMember, makePlayer, makeTeam, POSITIONS, ROLES } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: {
    get: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    attachLeagues: vi.fn(),
    detachLeague: vi.fn(),
  },
}))
vi.mock('@/services/api/players.service', () => ({
  playersService: { positions: vi.fn(), remove: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/services/api/technicalCommitteeMembers.service', () => ({
  technicalCommitteeMembersService: { roles: vi.fn(), remove: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/services/api/games.service', () => ({ gamesService: { list: vi.fn() } }))
vi.mock('@/services/api/gameEvents.service', () => ({ gameEventsService: { list: vi.fn() } }))

const team = makeTeam(5, 'Vitória FC', {
  nickname: 'Vitória',
  players: [
    makePlayer(11, 'Atacante Dois', { team_id: 5, position: 'ATA', number: 9 }),
    makePlayer(10, 'Goleiro Um', { team_id: 5, position: 'GOL', number: 1 }),
  ],
  technicalCommitteeMembers: [makeMember(20, 'Técnico Fulano', { team_id: 5 })],
})

const ALL_WRITE = [
  'team:update',
  'team:delete',
  'player:create',
  'player:update',
  'player:delete',
  'technical_committee_member:create',
  'technical_committee_member:update',
  'technical_committee_member:delete',
]

function game(id: number, home: number, away: number, hs: number, as: number): Game {
  return makeGame(id, { home_team_id: home, away_team_id: away, home_score: hs, away_score: as, status: 'finished' })
}

function goal(id: number, leagueId: number, playerId: number, assist: number | null = null): GameEvent {
  return {
    id,
    game_id: 1,
    team_id: 5,
    player_id: playerId,
    related_player_id: assist,
    league_id: leagueId,
    type: 'goal',
    minute: 10,
    created_at: '',
    updated_at: '',
  }
}

async function mountDetail(permissions: string[] = ALL_WRITE, query = '') {
  setupLeagueSession(makeUser('admin', permissions), [
    makeLeague(1, championshipA, { name: 'Série A' }),
    makeLeague(2, championshipB, { name: 'Copa' }),
  ])
  const router = createTestRouter()
  await router.push(`/admin/liga/1/times/5${query}`)
  const wrapper = mount(TeamDetailView, {
    props: { teamId: '5' },
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('TeamDetailView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(teamsService.get).mockResolvedValue(team)
    vi.mocked(playersService.positions).mockResolvedValue(POSITIONS)
    vi.mocked(technicalCommitteeMembersService.roles).mockResolvedValue(ROLES)
  })

  it('mostra o time com as abas Elenco | Comissão Técnica | Estatísticas e o elenco ordenado', async () => {
    const { wrapper } = await mountDetail()

    expect(teamsService.get).toHaveBeenCalledWith('5')
    expect(wrapper.find('[data-test="team-title"]').text()).toBe('Vitória FC')
    expect(wrapper.findAll('.v-tab').map((t) => t.text())).toEqual([
      'Elenco',
      'Comissão Técnica',
      'Estatísticas',
    ])
    const rows = wrapper.findAll('[data-test="players-table"] tbody tr')
    expect(rows.map((r) => r.findAll('td').slice(0, 3).map((td) => td.text()))).toEqual([
      ['1', 'Goleiro Um', 'Goleiro'],
      ['9', 'Atacante Dois', 'Atacante'],
    ])
  })

  it('mostra o escudo do time no cabeçalho', async () => {
    vi.mocked(teamsService.get).mockResolvedValue({ ...team, logo: 'http://api/storage/teams/v.png' })
    const { wrapper } = await mountDetail()

    const avatar = wrapper.find('.v-card-text .v-avatar')
    expect(avatar.findComponent({ name: 'VImg' }).props('src')).toBe('http://api/storage/teams/v.png')
  })

  it('sem escudo, mostra o ícone padrão no cabeçalho', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.find('.v-card-text .v-avatar .mdi-shield').exists()).toBe(true)
    expect(wrapper.find('.v-card-text .v-avatar .v-img').exists()).toBe(false)
  })

  it('aba Comissão Técnica lista os membros do time', async () => {
    const { wrapper } = await mountDetail(ALL_WRITE, '?tab=comissao')

    const rows = wrapper.findAll('[data-test="members-table"] tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Técnico Fulano')
    expect(rows[0].text()).toContain('Treinador')
  })

  it('aba Estatísticas calcula a campanha e artilharia só com dados da liga ativa', async () => {
    vi.mocked(gamesService.list).mockResolvedValue([game(1, 5, 8, 2, 1), game(2, 8, 5, 0, 0), game(3, 8, 9, 3, 0)])
    vi.mocked(gameEventsService.list).mockResolvedValue([
      goal(1, 1, 11, 10),
      goal(2, 1, 11),
      goal(3, 2, 11), // outra liga: ignorado
    ])
    const { wrapper } = await mountDetail(ALL_WRITE, '?tab=estatisticas')

    expect(gamesService.list).toHaveBeenCalledWith({ league_id: 1 })
    const tiles = wrapper.findAll('[data-test="team-stats"] .v-card').map((c) => c.text())
    expect(tiles.slice(0, 6)).toEqual(['2Jogos', '1Vitórias', '1Empates', '0Derrotas', '2Gols pró', '1Gols contra'])
    const scorers = wrapper.findAll('table tbody tr').map((r) => r.text())
    expect(scorers).toEqual(['Atacante Dois20', 'Goleiro Um01'])
  })

  it('sem permissões de escrita, nenhuma ação de criar/editar/excluir aparece', async () => {
    const { wrapper } = await mountDetail(['team:read', 'player:read'])

    for (const selector of ['team-leagues', 'team-edit', 'team-delete', 'player-create', 'player-edit', 'player-delete']) {
      expect(wrapper.find(`[data-test="${selector}"]`).exists(), selector).toBe(false)
    }
  })

  it('cada ação aparece conforme a permissão correspondente', async () => {
    const { wrapper } = await mountDetail(['player:create', 'player:all'])

    expect(wrapper.find('[data-test="team-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="player-create"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="player-edit"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="player-delete"]')).toHaveLength(2)
  })

  it('exclusão de time bloqueada pelo backend mostra a mensagem retornada', async () => {
    vi.mocked(teamsService.remove).mockRejectedValue(
      apiError(422, 'Não é possível remover o time pois existem partidas vinculadas a ele.'),
    )
    const { wrapper, router } = await mountDetail()

    await wrapper.find('[data-test="team-delete"]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('.v-overlay--active .v-card') as HTMLElement
    expect(dialog.textContent).toContain('2 jogador(es) e 1 membro(s) da comissão ficarão sem time')
    const confirm = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes('Excluir'))
    confirm!.click()
    await flushPromises()

    expect(teamsService.remove).toHaveBeenCalledWith(5)
    expect(useSnackbar().message.value).toBe(
      'Não é possível remover o time pois existem partidas vinculadas a ele.',
    )
    expect(router.currentRoute.value.name).toBe('admin-teams-detail')
  })

  it('vincula e desvincula o time de outra liga pelo dialog de ligas', async () => {
    vi.mocked(teamsService.get).mockResolvedValue({
      ...team,
      leagues: [{ id: 1, name: 'Série A' }],
    })
    vi.mocked(teamsService.attachLeagues).mockResolvedValue({
      ...team,
      leagues: [
        { id: 1, name: 'Série A' },
        { id: 2, name: 'Copa' },
      ],
    })
    vi.mocked(teamsService.detachLeague).mockResolvedValue({ ...team, leagues: [{ id: 1, name: 'Série A' }] })
    const { wrapper } = await mountDetail()

    await wrapper.find('[data-test="team-leagues"]').trigger('click')
    await flushPromises()

    const toggle = () => document.querySelector('[data-test="league-link-toggle"]') as HTMLButtonElement
    expect(document.querySelectorAll('[data-test="league-link-row"]')).toHaveLength(2)
    expect(document.body.textContent).toContain('Liga atual')
    expect(toggle().textContent).toContain('Vincular')

    toggle().click()
    await flushPromises()
    expect(teamsService.attachLeagues).toHaveBeenCalledWith(5, [2])
    expect(toggle().textContent).toContain('Desvincular')

    // Reabrir usa o `leagues` atualizado pelo evento `updated`, sem novo GET.
    const close = [...document.querySelectorAll('.v-overlay--active button')].find(
      (b) => b.textContent?.trim() === 'Fechar',
    ) as HTMLButtonElement
    close.click()
    await flushPromises()
    expect(document.querySelector('.v-overlay--active [data-test="league-link-toggle"]')).toBeNull()
    await wrapper.find('[data-test="team-leagues"]').trigger('click')
    await flushPromises()
    expect(toggle().textContent).toContain('Desvincular')
    expect(teamsService.get).toHaveBeenCalledTimes(1)

    toggle().click()
    await flushPromises()
    expect(teamsService.detachLeague).toHaveBeenCalledWith(5, 2)
    expect(toggle().textContent).toContain('Vincular')
    expect(
      vi.mocked(teamsService.list).mock.calls.filter(([params]) => params?.league_id != null),
    ).toEqual([])
  })
})
