import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChampionshipAdminListView from '@/views/admin/championships/ChampionshipAdminListView.vue'
import { championshipsService } from '@/services/api/championships.service'
import { leaguesService } from '@/services/api/leagues.service'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
} from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/championships.service', () => ({
  championshipsService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeWithPassword: vi.fn(),
  },
}))
vi.mock('@/services/api/leagues.service', () => ({ leaguesService: { list: vi.fn() } }))

const service = vi.mocked(championshipsService)

async function mountList() {
  const router = createTestRouter()
  await router.push({ name: 'admin-championships-list' })
  const wrapper = mount(ChampionshipAdminListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function dialogText(): string {
  return document.querySelector('.v-dialog.v-overlay--active')?.textContent ?? ''
}

function click(selector: string) {
  ;(document.querySelector(selector) as HTMLButtonElement).click()
  return flushPromises()
}

async function openDelete(wrapper: Awaited<ReturnType<typeof mountList>>) {
  await wrapper.find('[data-test="championship-delete"]').trigger('click')
  await flushPromises()
}

async function confirmWithPassword(password: string) {
  await click('[data-test="password-delete-continue"]')
  const input = document.querySelector(
    '[data-test="password-delete-password"] input',
  ) as HTMLInputElement
  input.value = password
  input.dispatchEvent(new Event('input'))
  await flushPromises()
  await click('[data-test="password-delete-confirm"]')
}

describe('ChampionshipAdminListView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = makeUser('master')
    service.list.mockResolvedValue([championshipA])
    service.get.mockResolvedValue({
      ...championshipA,
      leagues: [
        makeLeague(7, championshipA, { name: 'Série A' }),
        makeLeague(8, championshipA, { name: 'Série B' }),
      ],
    })
    vi.mocked(leaguesService.list).mockResolvedValue([])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('campeonato sem imagem usa fallback com cor do tema, não cor fixa (BUG-038)', async () => {
    const wrapper = await mountList()

    const fallback = wrapper.find('[data-test="championship-image-fallback"]')
    expect(fallback.exists()).toBe(true)
    expect(fallback.classes()).toContain('bg-surface-variant')
    expect(fallback.classes()).not.toContain('bg-grey-lighten-3')
  })

  it('o aviso busca o campeonato e lista as ligas e tudo o que cai junto', async () => {
    const wrapper = await mountList()

    await openDelete(wrapper)

    expect(service.get).toHaveBeenCalledWith(1)
    const text = dialogText()
    expect(text).toContain('Excluir campeonato Brasileiro')
    expect(text).toContain('A exclusão é imediata')
    expect(
      document.querySelector('[data-test="championship-delete-leagues"]')?.textContent?.trim(),
    ).toBe('Serão apagadas 2 ligas: Série A, Série B.')
    expect(
      [...document.querySelectorAll('[data-test="password-delete-removed"] li')].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      'partidas e súmulas das ligas',
      'estádios das ligas',
      'vínculos dos times e dos usuários com as ligas',
      'a imagem do campeonato',
    ])
    expect(text).toContain('Times, jogadores, comissão técnica e usuários continuam no sistema.')
    expect(document.querySelector('[data-test="password-delete-password"]')).toBeNull()
  })

  it('campeonato sem ligas avisa "Nenhuma liga"', async () => {
    service.get.mockResolvedValue({ ...championshipA, leagues: [] })
    const wrapper = await mountList()

    await openDelete(wrapper)

    expect(dialogText()).toContain('Nenhuma liga neste campeonato.')
  })

  it('enquanto busca as ligas não deixa continuar', async () => {
    service.get.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountList()

    await openDelete(wrapper)

    const next = document.querySelector('[data-test="password-delete-continue"]')
    expect((next as HTMLButtonElement).disabled).toBe(true)
  })

  it('senha errada mostra o erro e não exclui', async () => {
    service.removeWithPassword.mockRejectedValue(
      apiError(422, 'Senha incorreta.', { password: ['Senha incorreta.'] }),
    )
    const wrapper = await mountList()
    await openDelete(wrapper)

    await confirmWithPassword('errada')

    expect(service.removeWithPassword).toHaveBeenCalledWith(1, 'errada')
    expect(dialogText()).toContain('Senha incorreta.')
    expect(service.list).toHaveBeenCalledOnce()
    expect(useSnackbar().message.value).not.toBe('Campeonato excluído com sucesso.')
  })

  it('sucesso limpa a liga ativa do campeonato, recarrega o contexto e a lista', async () => {
    service.removeWithPassword.mockResolvedValue({} as never)
    const context = useLeagueContextStore()
    context.setActiveLeague(8)
    const wrapper = await mountList()
    await openDelete(wrapper)

    await confirmWithPassword('123456')

    expect(service.removeWithPassword).toHaveBeenCalledWith(1, '123456')
    expect(context.activeLeagueId).toBeNull()
    expect(localStorage.getItem('footfy_active_league')).toBeNull()
    expect(leaguesService.list).toHaveBeenCalled()
    expect(service.list).toHaveBeenCalledTimes(3)
    expect(useSnackbar().message.value).toBe('Campeonato excluído com sucesso.')
    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()
  })

  it('liga ativa de outro campeonato continua ativa', async () => {
    service.removeWithPassword.mockResolvedValue({} as never)
    const context = useLeagueContextStore()
    context.setActiveLeague(99)
    const wrapper = await mountList()
    await openDelete(wrapper)

    await confirmWithPassword('123456')

    expect(context.activeLeagueId).toBe(99)
    expect(leaguesService.list).toHaveBeenCalled()
  })

  it('falha ao buscar o campeonato fecha o aviso e mostra o erro', async () => {
    service.get.mockRejectedValue(apiError(500, 'Erro'))
    const wrapper = await mountList()

    await openDelete(wrapper)

    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()
    expect(useSnackbar().message.value).toBe('Não foi possível carregar o campeonato.')
  })
})
