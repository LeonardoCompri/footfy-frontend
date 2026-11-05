import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LeagueDeleteDialog from '@/components/championships/LeagueDeleteDialog.vue'
import { leaguesService } from '@/services/api/leagues.service'
import { createTestVuetify } from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { removeWithPassword: vi.fn() },
}))

const removeWithPassword = vi.mocked(leaguesService.removeWithPassword)

async function mountDialog() {
  const wrapper = mount(LeagueDeleteDialog, {
    props: { modelValue: false, league: { id: 7, name: 'Série A' } },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  return wrapper
}

function dialogText(): string {
  return document.querySelector('[data-test="league-delete-dialog"]')?.textContent ?? ''
}

function click(selector: string) {
  ;(document.querySelector(selector) as HTMLButtonElement).click()
  return flushPromises()
}

async function typePassword(value: string) {
  const input = document.querySelector(
    '[data-test="league-delete-password"] input',
  ) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function goToPasswordStep() {
  const wrapper = await mountDialog()
  await click('[data-test="league-delete-continue"]')
  await typePassword('senha-do-master')
  return wrapper
}

describe('LeagueDeleteDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    removeWithPassword.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('primeiro avisa o que será apagado, sem pedir a senha', async () => {
    await mountDialog()

    const text = dialogText()
    expect(text).toContain('Excluir liga Série A')
    expect(text).toContain('não depende do botão Salvar')
    expect(text).toContain('partidas e súmulas')
    expect(text).toContain('estádios da liga')
    expect(text).toContain('vínculos dos times e dos usuários com a liga')
    expect(text).toContain('Times, jogadores, comissão técnica e usuários continuam no sistema')
    expect(document.querySelector('[data-test="league-delete-password"]')).toBeNull()
  })

  it('no segundo passo exclui com a senha e avisa quem abriu', async () => {
    removeWithPassword.mockResolvedValue({} as never)
    const wrapper = await goToPasswordStep()

    await click('[data-test="league-delete-confirm"]')

    expect(removeWithPassword).toHaveBeenCalledWith(7, 'senha-do-master')
    expect(wrapper.emitted('deleted')).toEqual([[7]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('senha errada (422) mostra "Senha incorreta." e mantém o diálogo aberto', async () => {
    removeWithPassword.mockRejectedValue(
      apiError(422, 'Senha incorreta.', { password: ['Senha incorreta.'] }),
    )
    const wrapper = await goToPasswordStep()

    await click('[data-test="league-delete-confirm"]')

    expect(dialogText()).toContain('Senha incorreta.')
    expect(wrapper.emitted('deleted')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('excesso de tentativas (429) pede para aguardar', async () => {
    removeWithPassword.mockRejectedValue(apiError(429, 'Too Many Attempts.'))
    await goToPasswordStep()

    await click('[data-test="league-delete-confirm"]')

    expect(dialogText()).toContain('Muitas tentativas. Aguarde um minuto.')
  })

  it('não envia sem senha', async () => {
    await mountDialog()
    await click('[data-test="league-delete-continue"]')

    const confirm = document.querySelector(
      '[data-test="league-delete-confirm"]',
    ) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(removeWithPassword).not.toHaveBeenCalled()
  })
})
