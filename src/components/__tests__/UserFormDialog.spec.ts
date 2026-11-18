import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UserFormDialog from '@/components/users/UserFormDialog.vue'
import { usersService } from '@/services/api/users.service'
import { teamsService } from '@/services/api/teams.service'
import { playersService } from '@/services/api/players.service'
import {
  championshipA,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError, makeAppUser, makePlayer, makeTeam } from '@/test/factories'
import type { User } from '@/types/user'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/users.service', () => ({
  usersService: { create: vi.fn(), update: vi.fn(), attachLeagues: vi.fn() },
}))
vi.mock('@/services/api/teams.service', () => ({ teamsService: { listPaginated: vi.fn() } }))
vi.mock('@/services/api/players.service', () => ({
  playersService: { listPaginated: vi.fn() },
}))

const TEAMS = [makeTeam(5, 'Vitória FC'), makeTeam(6, 'Atlético')]
const PLAYERS = [
  makePlayer(10, 'Fulano', { team_id: 5, document: '12345678901' }),
  makePlayer(11, 'Beltrano', { team_id: 6, document: '98765432100' }),
  makePlayer(12, 'Ciclano de Fora', { team_id: 9, document: '11122233344' }),
]

function paginated<T>(data: T[]) {
  return { data, meta: { current_page: 1, per_page: 20, total: data.length, last_page: 1 } }
}

function searchedPlayers(search: string | undefined) {
  if (!search) return PLAYERS
  if (/^\d+$/.test(search)) return PLAYERS.filter((player) => player.document?.includes(search))
  return PLAYERS.filter((player) => player.name.includes(search))
}

const teamSearchParams = (search?: string) => ({
  league_id: 1,
  search,
  sort: 'name',
  order: 'asc',
  page: 1,
  per_page: 20,
})

async function mountDialog(role: 'master' | 'admin', user: User | null = null) {
  setupLeagueSession(makeUser(role), [makeLeague(1, championshipA, { name: 'Série A' })])
  const wrapper = mount(UserFormDialog, {
    props: { modelValue: true, user },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function field(wrapper: VueWrapper, name: 'VSelect' | 'VAutocomplete', dataTest: string) {
  return wrapper.findAllComponents({ name }).find((c) => c.attributes('data-test') === dataTest)
}

async function choose(
  wrapper: VueWrapper,
  name: 'VSelect' | 'VAutocomplete',
  dataTest: string,
  value: unknown,
) {
  field(wrapper, name, dataTest)!.vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function setInput(selector: string, value: string) {
  const input = document.querySelector(`${selector} input`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function fillBasics(cpf = '555.666.777-88') {
  await setInput('[data-test="user-name"]', 'Novo')
  await setInput('[data-test="user-document"]', cpf)
  await setInput('[data-test="user-password"]', 'segredo1')
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

async function typeSearch(wrapper: VueWrapper, dataTest: string, value: string) {
  field(wrapper, 'VAutocomplete', dataTest)!.vm.$emit('update:search', value)
  await flushPromises()
}

function items(wrapper: VueWrapper, dataTest: string) {
  return field(wrapper, 'VAutocomplete', dataTest)!.props('items')
}

describe('UserFormDialog — vínculo por papel', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(teamsService.listPaginated).mockResolvedValue(paginated(TEAMS))
    vi.mocked(playersService.listPaginated).mockImplementation(async (params) =>
      paginated(searchedPlayers(params.search)),
    )
    vi.mocked(usersService.create).mockImplementation(async (payload) =>
      makeAppUser(30, payload.name, payload.role ?? 'coach'),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('admin cria só coach ou player; coach busca o time na liga ativa', async () => {
    const wrapper = await mountDialog('admin')

    const role = field(wrapper, 'VSelect', 'user-role')!
    expect(role.props('items').map((o: { value: string }) => o.value)).toEqual(['coach', 'player'])
    expect(role.props('modelValue')).toBe('coach')
    expect(teamsService.listPaginated).toHaveBeenCalledTimes(1)
    expect(teamsService.listPaginated).toHaveBeenCalledWith(teamSearchParams())
    expect(playersService.listPaginated).not.toHaveBeenCalled()
    expect(items(wrapper, 'user-team')).toEqual([
      { id: 5, title: 'Vitória FC' },
      { id: 6, title: 'Atlético' },
    ])
    expect(field(wrapper, 'VAutocomplete', 'user-player')).toBeUndefined()
    expect(field(wrapper, 'VAutocomplete', 'user-leagues')).toBeUndefined()
  })

  it('busca de time vai ao servidor só depois do debounce, com o último termo', async () => {
    const wrapper = await mountDialog('admin')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.mocked(teamsService.listPaginated).mockClear()
    vi.mocked(teamsService.listPaginated).mockResolvedValue(paginated([TEAMS[1]]))

    await typeSearch(wrapper, 'user-team', 'A')
    await typeSearch(wrapper, 'user-team', 'Atl ')
    vi.advanceTimersByTime(299)
    await flushPromises()
    expect(teamsService.listPaginated).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(teamsService.listPaginated).toHaveBeenCalledTimes(1)
    expect(teamsService.listPaginated).toHaveBeenCalledWith(teamSearchParams('Atl'))
    expect(items(wrapper, 'user-team')).toEqual([{ id: 6, title: 'Atlético' }])
  })

  it('ignora a resposta de uma busca antiga que chega depois da mais recente', async () => {
    const wrapper = await mountDialog('admin')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let resolveSlow!: (value: ReturnType<typeof paginated<(typeof TEAMS)[number]>>) => void
    vi.mocked(teamsService.listPaginated)
      .mockReturnValueOnce(new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce(paginated([TEAMS[1]]))

    await typeSearch(wrapper, 'user-team', 'Vit')
    vi.advanceTimersByTime(300)
    await typeSearch(wrapper, 'user-team', 'Atl')
    vi.advanceTimersByTime(300)
    await flushPromises()
    resolveSlow(paginated([TEAMS[0]]))
    await flushPromises()

    expect(items(wrapper, 'user-team')).toEqual([{ id: 6, title: 'Atlético' }])
  })

  it('admin: coach sem time não salva; com time envia team_id e não vincula ligas', async () => {
    const wrapper = await mountDialog('admin')
    await fillBasics()

    await submit()
    expect(document.body.textContent).toContain('Informe o time do coach.')
    expect(usersService.create).not.toHaveBeenCalled()

    await choose(wrapper, 'VAutocomplete', 'user-team', 6)
    await submit()
    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Novo',
      document: '55566677788',
      email: null,
      password: 'segredo1',
      role: 'coach',
      team_id: 6,
    })
    expect(usersService.attachLeagues).not.toHaveBeenCalled()
  })

  it('o time escolhido continua visível quando uma nova busca não o traz', async () => {
    const wrapper = await mountDialog('admin')
    await choose(wrapper, 'VAutocomplete', 'user-team', 6)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.mocked(teamsService.listPaginated).mockClear()
    vi.mocked(teamsService.listPaginated).mockResolvedValue(paginated([TEAMS[0]]))

    await typeSearch(wrapper, 'user-team', 'Atlético')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(teamsService.listPaginated).not.toHaveBeenCalled()

    await typeSearch(wrapper, 'user-team', 'Vit')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(items(wrapper, 'user-team')).toEqual([
      { id: 6, title: 'Atlético' },
      { id: 5, title: 'Vitória FC' },
    ])
    expect(field(wrapper, 'VAutocomplete', 'user-team')!.props('modelValue')).toBe(6)
  })

  it('admin: player busca jogadores no servidor e mostra o time da liga ativa', async () => {
    const wrapper = await mountDialog('admin')
    await choose(wrapper, 'VSelect', 'user-role', 'player')

    expect(field(wrapper, 'VAutocomplete', 'user-team')).toBeUndefined()
    expect(playersService.listPaginated).toHaveBeenCalledWith({
      league_id: 1,
      search: undefined,
      sort: 'name',
      order: 'asc',
      page: 1,
      per_page: 20,
    })
    expect(teamsService.listPaginated).toHaveBeenCalledWith({
      league_id: 1,
      page: 1,
      per_page: 100,
    })
    expect(items(wrapper, 'user-player')).toEqual([
      { id: 10, title: 'Fulano (Vitória FC)' },
      { id: 11, title: 'Beltrano (Atlético)' },
      { id: 12, title: 'Ciclano de Fora' },
    ])
    expect(field(wrapper, 'VAutocomplete', 'user-player')!.props('modelValue')).toBeNull()

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await typeSearch(wrapper, 'user-player', 'Belt')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(playersService.listPaginated).toHaveBeenLastCalledWith(
      expect.objectContaining({
        league_id: 1,
        search: 'Belt',
        sort: 'name',
        page: 1,
        per_page: 20,
      }),
    )
    expect(items(wrapper, 'user-player')).toEqual([{ id: 11, title: 'Beltrano (Atlético)' }])
  })

  it('sugere o jogador do mesmo CPF buscando no servidor', async () => {
    const wrapper = await mountDialog('admin')
    await choose(wrapper, 'VSelect', 'user-role', 'player')

    await fillBasics('123.456.789-01')

    expect(playersService.listPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ league_id: 1, search: '12345678901', page: 1, per_page: 5 }),
    )
    expect(field(wrapper, 'VAutocomplete', 'user-player')!.props('modelValue')).toBe(10)
    expect(items(wrapper, 'user-player')).toContainEqual({ id: 10, title: 'Fulano (Vitória FC)' })

    await submit()
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'player', document: '12345678901', player_id: 10 }),
    )
    expect(usersService.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ team_id: expect.anything() }),
    )
  })

  it('a sugestão por CPF não sobrescreve um jogador já escolhido', async () => {
    const wrapper = await mountDialog('admin')
    await choose(wrapper, 'VSelect', 'user-role', 'player')
    await choose(wrapper, 'VAutocomplete', 'user-player', 11)

    await fillBasics('123.456.789-01')

    expect(field(wrapper, 'VAutocomplete', 'user-player')!.props('modelValue')).toBe(11)
  })

  it('admin: player sem jogador não salva', async () => {
    const wrapper = await mountDialog('admin')
    await choose(wrapper, 'VSelect', 'user-role', 'player')
    await fillBasics()

    await submit()

    expect(document.body.textContent).toContain('Informe o jogador vinculado ao usuário.')
    expect(usersService.create).not.toHaveBeenCalled()
  })

  it('mostra o erro de vínculo devolvido pelo backend no campo', async () => {
    vi.mocked(usersService.create).mockRejectedValue(
      apiError(422, 'Dados inválidos.', {
        team_id: ['Este time já está vinculado a outro coach.'],
      }),
    )
    const wrapper = await mountDialog('admin')
    await fillBasics()
    await choose(wrapper, 'VAutocomplete', 'user-team', 5)

    await submit()

    expect(field(wrapper, 'VAutocomplete', 'user-team')!.text()).toContain(
      'Este time já está vinculado a outro coach.',
    )
  })

  it('master escolhe qualquer papel e pode deixar coach sem time', async () => {
    const wrapper = await mountDialog('master')

    const role = field(wrapper, 'VSelect', 'user-role')!
    expect(role.props('items').map((o: { value: string }) => o.value)).toEqual([
      'master',
      'admin',
      'coach',
      'player',
    ])
    expect(role.props('modelValue')).toBe('admin')
    expect(teamsService.listPaginated).not.toHaveBeenCalled()

    await choose(wrapper, 'VSelect', 'user-role', 'coach')
    await fillBasics()
    await submit()

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'coach', team_id: null }),
    )
  })

  it('edição por admin: mantém o papel e mostra o time do coach, mesmo fora da liga ativa', async () => {
    const coach = makeAppUser(3, 'Tite', 'coach', {
      team: { id: 9, name: 'Time de Fora', logo: null },
    })
    vi.mocked(usersService.update).mockResolvedValue(coach)
    const wrapper = await mountDialog('admin', coach)

    expect(field(wrapper, 'VSelect', 'user-role')).toBeUndefined()
    const team = field(wrapper, 'VAutocomplete', 'user-team')!
    expect(team.props('modelValue')).toBe(9)
    expect(team.props('items')).toEqual([
      { id: 9, title: 'Time de Fora' },
      { id: 5, title: 'Vitória FC' },
      { id: 6, title: 'Atlético' },
    ])
    expect(team.find('.v-autocomplete__selection').text()).toBe('Time de Fora')

    await submit()
    expect(usersService.update).toHaveBeenCalledWith(3, {
      name: 'Tite',
      document: coach.document,
      email: null,
      team_id: 9,
    })
  })

  it('edição de player mostra o jogador vinculado mesmo fora dos resultados', async () => {
    const player = makeAppUser(4, 'Fulano', 'player', {
      document: '98765432100',
      team: { id: 7, name: 'Time de Outra Liga', logo: null },
      player: { id: 20, name: 'Fulano Antigo', team_id: 7 },
    })
    vi.mocked(usersService.update).mockResolvedValue(player)
    const wrapper = await mountDialog('admin', player)

    const playerField = field(wrapper, 'VAutocomplete', 'user-player')!
    expect(playerField.props('modelValue')).toBe(20)
    expect(playerField.props('items')[0]).toEqual({
      id: 20,
      title: 'Fulano Antigo (Time de Outra Liga)',
    })
    expect(playerField.find('.v-autocomplete__selection').text()).toBe(
      'Fulano Antigo (Time de Outra Liga)',
    )
    expect(playersService.listPaginated).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: '98765432100' }),
    )

    await submit()
    expect(usersService.update).toHaveBeenCalledWith(4, expect.objectContaining({ player_id: 20 }))
  })

  it('master trocando player para coach envia só o time (sem player_id)', async () => {
    const player = makeAppUser(4, 'Fulano', 'player', {
      player: { id: 10, name: 'Fulano', team_id: 5 },
    })
    vi.mocked(usersService.update).mockResolvedValue(player)
    const wrapper = await mountDialog('master', player)

    await choose(wrapper, 'VSelect', 'user-role', 'coach')
    expect(field(wrapper, 'VAutocomplete', 'user-team')!.props('modelValue')).toBeNull()
    await choose(wrapper, 'VAutocomplete', 'user-team', 5)
    await submit()

    expect(usersService.update).toHaveBeenCalledWith(4, {
      name: 'Fulano',
      document: player.document,
      email: null,
      role: 'coach',
      team_id: 5,
    })
  })
})
