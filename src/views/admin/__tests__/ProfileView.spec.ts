import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from '@/views/admin/profile/ProfileView.vue'
import { profileService } from '@/services/api/profile.service'
import { playersService } from '@/services/api/players.service'
import { useAuthStore } from '@/stores/auth'
import { createTestVuetify, makeUser } from '@/test/utils'
import { apiError, makeAppUser, makePlayer } from '@/test/factories'
import type { AuthUser } from '@/types/auth'
import type { User } from '@/types/user'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/profile.service', () => ({
  profileService: { get: vi.fn(), update: vi.fn(), updatePlayer: vi.fn() },
}))
vi.mock('@/services/api/players.service', () => ({ playersService: { get: vi.fn() } }))

const linkedPlayer = { id: 10, name: 'Fulano', team_id: 5 }

// O /me devolve `roles` como strings; o store guarda os objetos do login (com permissions).
function meOf(role: string, extra: Partial<User> = {}) {
  return makeAppUser(1, 'Usuário Teste', role, {
    email: 'teste@footfy.com',
    document: '12345678901',
    ...extra,
  })
}

async function mountProfile(role: string, me: User, session: Partial<AuthUser> = {}) {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser(role, ['player:read'], { email: 'teste@footfy.com', ...session })
  vi.mocked(profileService.get).mockResolvedValue(me)
  const wrapper = mount(ProfileView, {
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, auth }
}

function input(dataTest: string) {
  return document.querySelector(`[data-test="${dataTest}"] input`) as HTMLInputElement
}

async function setInput(dataTest: string, value: string) {
  const el = input(dataTest)
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function submit(block: 'account' | 'player') {
  ;(document.querySelector(`[data-test="${block}-submit"]`) as HTMLButtonElement).click()
  await flushPromises()
}

function text(dataTest: string) {
  return document.querySelector(`[data-test="${dataTest}"]`)?.textContent ?? ''
}

describe('ProfileView — Meu perfil', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('coach vê só o bloco Conta, preenchido pelo /me', async () => {
    await mountProfile('coach', meOf('coach'))

    expect(input('account-name').value).toBe('Usuário Teste')
    expect(input('account-email').value).toBe('teste@footfy.com')
    expect(input('account-document').value).toBe('123.456.789-01')
    expect(input('account-password').value).toBe('')
    expect(document.querySelector('[data-test="player-card"]')).toBeNull()
    expect(playersService.get).not.toHaveBeenCalled()
  })

  it('player vê o bloco de jogador com nome e nascimento da ficha do jogador', async () => {
    vi.mocked(playersService.get).mockResolvedValue(
      makePlayer(10, 'Fulano da Silva', { birth_date: '2000-03-15T00:00:00.000000Z' }),
    )
    await mountProfile('player', meOf('player', { player: linkedPlayer }), { player: linkedPlayer })

    expect(playersService.get).toHaveBeenCalledWith(10)
    expect(text('player-card')).toContain('Meus dados de jogador')
    expect(input('player-name').value).toBe('Fulano da Silva')
    expect(input('player-birth-date').value).toBe('2000-03-15')
  })

  it('player: se a ficha do jogador falhar, usa o nome do vínculo e deixa o nascimento vazio', async () => {
    vi.mocked(playersService.get).mockRejectedValue(apiError(500, 'Erro'))
    await mountProfile('player', meOf('player', { player: linkedPlayer }))

    expect(input('player-name').value).toBe('Fulano')
    expect(input('player-birth-date').value).toBe('')
    expect(input('account-name').value).toBe('Usuário Teste')
  })

  it('player removido do elenco (/me sem player) ainda vê o bloco, vazio', async () => {
    await mountProfile('player', meOf('player', { player: null }))

    expect(document.querySelector('[data-test="player-card"]')).not.toBeNull()
    expect(input('player-name').value).toBe('')
    expect(playersService.get).not.toHaveBeenCalled()
  })

  it('sem o /me a tela usa os dados da sessão e avisa', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = makeUser('admin', [], { name: 'Da Sessão', email: 'sessao@footfy.com' })
    vi.mocked(profileService.get).mockRejectedValue(apiError(500, 'Houve um erro no servidor.'))
    mount(ProfileView, { global: { plugins: [createTestVuetify()] }, attachTo: document.body })
    await flushPromises()

    expect(text('load-error')).toContain('Houve um erro no servidor.')
    expect(input('account-name').value).toBe('Da Sessão')
    expect(input('account-email').value).toBe('sessao@footfy.com')
  })

  it('salva a conta sem senha e mescla só nome e e-mail no usuário da sessão', async () => {
    vi.mocked(profileService.update).mockResolvedValue(
      meOf('coach', { name: 'Novo Nome', email: 'novo@footfy.com' }),
    )
    const { auth } = await mountProfile('coach', meOf('coach'))

    await setInput('account-name', 'Novo Nome')
    await setInput('account-email', 'novo@footfy.com')
    await submit('account')

    expect(profileService.update).toHaveBeenCalledWith({
      name: 'Novo Nome',
      email: 'novo@footfy.com',
    })
    expect(auth.user?.name).toBe('Novo Nome')
    expect(auth.user?.email).toBe('novo@footfy.com')
    // roles do store continuam objetos (o /me devolve strings): hasRole segue funcionando.
    expect(auth.user?.roles).toEqual([{ id: 1, name: 'coach', guard_name: 'sanctum' }])
    expect(auth.hasRole('coach')).toBe(true)
    expect(JSON.parse(localStorage.getItem('footfy_auth')!).user.name).toBe('Novo Nome')
  })

  it('e-mail vazio vai como null', async () => {
    vi.mocked(profileService.update).mockResolvedValue(meOf('admin', { email: null }))
    await mountProfile('admin', meOf('admin'))

    await setInput('account-email', '')
    await submit('account')

    expect(profileService.update).toHaveBeenCalledWith({ name: 'Usuário Teste', email: null })
  })

  it('com nova senha envia password e password_confirmation e limpa os campos', async () => {
    vi.mocked(profileService.update).mockResolvedValue(meOf('coach'))
    await mountProfile('coach', meOf('coach'))

    await setInput('account-password', 'segredo1')
    await setInput('account-password-confirmation', 'segredo1')
    await submit('account')

    expect(profileService.update).toHaveBeenCalledWith({
      name: 'Usuário Teste',
      email: 'teste@footfy.com',
      password: 'segredo1',
      password_confirmation: 'segredo1',
    })
    expect(input('account-password').value).toBe('')
    expect(input('account-password-confirmation').value).toBe('')
  })

  it.each([
    ['nome vazio', 'account-name', '', 'Campo obrigatório.'],
    ['e-mail inválido', 'account-email', 'teste@', 'Informe um e-mail válido.'],
    ['senha curta', 'account-password', '123', 'A senha deve ter no mínimo 6 caracteres.'],
    [
      'confirmação diferente',
      'account-password',
      'segredo1',
      'A confirmação da senha não confere.',
    ],
  ])('não envia com %s', async (_label, dataTest, value, message) => {
    await mountProfile('coach', meOf('coach'))

    await setInput(dataTest, value)
    await submit('account')

    expect(text('account-card')).toContain(message)
    expect(profileService.update).not.toHaveBeenCalled()
  })

  it('mostra a mensagem e o erro de campo do 422 da conta', async () => {
    vi.mocked(profileService.update).mockRejectedValue(
      apiError(422, 'Este e-mail já está em uso por outro usuário.', {
        email: ['Este e-mail já está em uso por outro usuário.'],
      }),
    )
    const { auth } = await mountProfile('coach', meOf('coach'))

    await setInput('account-email', 'outro@footfy.com')
    await submit('account')

    expect(text('account-error')).toContain('Este e-mail já está em uso por outro usuário.')
    expect(text('account-email')).toContain('Este e-mail já está em uso por outro usuário.')
    expect(auth.user?.email).toBe('teste@footfy.com')
  })

  it('player salva nome e nascimento e atualiza o nome do jogador na sessão', async () => {
    vi.mocked(playersService.get).mockResolvedValue(makePlayer(10, 'Fulano'))
    vi.mocked(profileService.updatePlayer).mockResolvedValue(
      makePlayer(10, 'Fulano de Tal', { birth_date: '1999-12-31' }),
    )
    const { auth } = await mountProfile('player', meOf('player', { player: linkedPlayer }), {
      player: linkedPlayer,
    })

    await setInput('player-name', 'Fulano de Tal')
    await setInput('player-birth-date', '1999-12-31')
    await submit('player')

    expect(profileService.updatePlayer).toHaveBeenCalledWith({
      name: 'Fulano de Tal',
      birth_date: '1999-12-31',
    })
    expect(profileService.update).not.toHaveBeenCalled()
    expect(auth.user?.player).toEqual({ ...linkedPlayer, name: 'Fulano de Tal' })
  })

  it('player sem nascimento envia birth_date null', async () => {
    vi.mocked(playersService.get).mockResolvedValue(makePlayer(10, 'Fulano'))
    vi.mocked(profileService.updatePlayer).mockResolvedValue(makePlayer(10, 'Fulano'))
    await mountProfile('player', meOf('player', { player: linkedPlayer }))

    await submit('player')

    expect(profileService.updatePlayer).toHaveBeenCalledWith({ name: 'Fulano', birth_date: null })
  })

  it.each([
    ['removido do elenco (422 só com message)', 422, 'Você foi removido do elenco.'],
    ['sem jogador vinculado (404)', 404, 'Nenhum jogador vinculado à sua conta.'],
  ])('player %s: mostra a mensagem da API sem quebrar a tela', async (_label, status, message) => {
    vi.mocked(profileService.updatePlayer).mockRejectedValue(apiError(status, message))
    const { auth } = await mountProfile('player', meOf('player', { player: null }), {
      player: null,
    })

    await setInput('player-name', 'Fulano')
    await submit('player')

    expect(text('player-error')).toContain(message)
    expect(input('player-name').value).toBe('Fulano')
    expect(text('account-error')).toBe('')
    expect(auth.user?.player).toBeNull()
  })
})
