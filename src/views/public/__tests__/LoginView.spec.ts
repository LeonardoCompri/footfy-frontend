import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/public/LoginView.vue'
import { authService } from '@/services/api/auth.service'
import { createTestRouter, createTestVuetify, makeUser } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/auth.service', () => ({
  authService: { login: vi.fn(), logout: vi.fn() },
}))

async function mountLogin() {
  const router = createTestRouter()
  await router.push('/login')
  const wrapper = mount(LoginView, { global: { plugins: [createTestVuetify(), router] } })
  await flushPromises()
  return { wrapper, router }
}

async function fill(
  wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper'],
  cpf: string,
  password: string,
) {
  const [cpfInput, passwordInput] = wrapper.findAll('input')
  await cpfInput!.setValue(cpf)
  await passwordInput!.setValue(password)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('não chama a API com CPF incompleto e mostra o erro no campo', async () => {
    const { wrapper } = await mountLogin()

    await fill(wrapper, '123.456', '123456')

    expect(authService.login).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('O CPF deve ter 11 dígitos.')
  })

  it('não chama a API sem senha', async () => {
    const { wrapper } = await mountLogin()

    await fill(wrapper, '123.456.789-01', '')

    expect(authService.login).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Campo obrigatório.')
  })

  it('com dados válidos envia o CPF só com dígitos e segue para a seleção de campeonato', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      data: { token: 'token', user: makeUser('admin', []) },
    } as Awaited<ReturnType<typeof authService.login>>)
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, '123.456.789-01', '123456')

    expect(authService.login).toHaveBeenCalledWith({ document: '12345678901', password: '123456' })
    expect(router.currentRoute.value.name).toBe('admin-select-championship')
  })

  it('submit repetido enquanto o login está em andamento chama a API uma vez só', async () => {
    vi.mocked(authService.login).mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountLogin()

    await fill(wrapper, '123.456.789-01', '123456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authService.login).toHaveBeenCalledTimes(1)
  })
})
