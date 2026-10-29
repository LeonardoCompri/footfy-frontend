import { beforeEach, describe, expect, it, vi } from 'vitest'
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
vi.mock('@/services/api/teams.service', () => ({ teamsService: { list: vi.fn() } }))
vi.mock('@/services/api/players.service', () => ({ playersService: { list: vi.fn() } }))

// Liga ativa 1 tem Vitória (5) e Atlético (6); o time 9 é de outra liga.
const TEAMS = [makeTeam(5, 'Vitória FC'), makeTeam(6, 'Atlético')]
const PLAYERS = [
  makePlayer(10, 'Fulano', { team_id: 5, document: '12345678901' }),
  makePlayer(11, 'Beltrano', { team_id: 6, document: '98765432100' }),
  makePlayer(12, 'Ciclano de Fora', { team_id: 9, document: '11122233344' }),
]

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

describe('UserFormDialog — vínculo por papel', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(teamsService.list).mockResolvedValue(TEAMS)
    vi.mocked(playersService.list).mockResolvedValue(PLAYERS)
    vi.mocked(usersService.create).mockImplementation(async (payload) =>
      makeAppUser(30, payload.name, payload.role ?? 'coach'),
    )
  })

  it('admin cria só coach ou player; coach pede o time da liga ativa', async () => {
    const wrapper = await mountDialog('admin')

    const role = field(wrapper, 'VSelect', 'user-role')!
    expect(role.props('items').map((o: { value: string }) => o.value)).toEqual(['coach', 'player'])
    expect(role.props('modelValue')).toBe('coach')
    expect(teamsService.list).toHaveBeenCalledWith({ league_id: 1 })
    expect(playersService.list).not.toHaveBeenCalled()
    expect(field(wrapper, 'VSelect', 'user-team')!.props('items')).toEqual([
      { id: 5, title: 'Vitória FC' },
      { id: 6, title: 'Atlético' },
    ])
    expect(field(wrapper, 'VAutocomplete', 'user-player')).toBeUndefined()
    expect(field(wrapper, 'VAutocomplete', 'user-leagues')).toBeUndefined()
  })

  it('admin: coach sem time não salva; com time envia team_id e não vincula ligas', async () => {
    const wrapper = await mountDialog('admin')
    await fillBasics()

    await submit()
    expect(document.body.textContent).toContain('Informe o time do coach.')
    expect(usersService.create).not.toHaveBeenCalled()

    await choose(wrapper, 'VSelect', 'user-team', 6)
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

  it('admin: player lista só jogadores dos times da liga ativa e sugere o do mesmo CPF', async () => {
    const wrapper = await mountDialog('admin')
    await choose(wrapper, 'VSelect', 'user-role', 'player')

    expect(field(wrapper, 'VSelect', 'user-team')).toBeUndefined()
    const playerField = () => field(wrapper, 'VAutocomplete', 'user-player')!
    expect(playerField().props('items')).toEqual([
      { id: 10, title: 'Fulano (Vitória FC)' },
      { id: 11, title: 'Beltrano (Atlético)' },
    ])
    expect(playerField().props('modelValue')).toBeNull()

    await fillBasics('123.456.789-01')
    expect(playerField().props('modelValue')).toBe(10)

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
    await choose(wrapper, 'VSelect', 'user-team', 5)

    await submit()

    expect(field(wrapper, 'VSelect', 'user-team')!.text()).toContain(
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
    expect(teamsService.list).not.toHaveBeenCalled()

    await choose(wrapper, 'VSelect', 'user-role', 'coach')
    await fillBasics()
    await submit()

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'coach', team_id: null }),
    )
  })

  it('edição por admin: mantém o papel e pré-seleciona o time do coach, mesmo fora da liga ativa', async () => {
    const coach = makeAppUser(3, 'Tite', 'coach', {
      team: { id: 9, name: 'Time de Fora', logo: null },
    })
    vi.mocked(usersService.update).mockResolvedValue(coach)
    const wrapper = await mountDialog('admin', coach)

    expect(field(wrapper, 'VSelect', 'user-role')).toBeUndefined()
    const team = field(wrapper, 'VSelect', 'user-team')!
    expect(team.props('modelValue')).toBe(9)
    expect(team.props('items')).toContainEqual({ id: 9, title: 'Time de Fora' })

    await submit()
    expect(usersService.update).toHaveBeenCalledWith(3, {
      name: 'Tite',
      document: coach.document,
      email: null,
      team_id: 9,
    })
  })

  it('edição de player pré-seleciona o jogador vinculado', async () => {
    const player = makeAppUser(4, 'Fulano', 'player', {
      document: '98765432100',
      team: { id: 5, name: 'Vitória FC', logo: null },
      player: { id: 10, name: 'Fulano', team_id: 5 },
    })
    vi.mocked(usersService.update).mockResolvedValue(player)
    const wrapper = await mountDialog('admin', player)

    // O CPF bate com o Beltrano, mas o vínculo atual não é trocado pela sugestão.
    expect(field(wrapper, 'VAutocomplete', 'user-player')!.props('modelValue')).toBe(10)
    await submit()
    expect(usersService.update).toHaveBeenCalledWith(4, expect.objectContaining({ player_id: 10 }))
  })

  it('master trocando player para coach envia só o time (sem player_id)', async () => {
    const player = makeAppUser(4, 'Fulano', 'player', {
      player: { id: 10, name: 'Fulano', team_id: 5 },
    })
    vi.mocked(usersService.update).mockResolvedValue(player)
    const wrapper = await mountDialog('master', player)

    await choose(wrapper, 'VSelect', 'user-role', 'coach')
    await choose(wrapper, 'VSelect', 'user-team', 5)
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
