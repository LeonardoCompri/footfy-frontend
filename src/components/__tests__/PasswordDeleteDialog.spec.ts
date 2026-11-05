import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PasswordDeleteDialog from '@/components/common/PasswordDeleteDialog.vue'
import { createTestVuetify } from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))

const request = vi.fn()

async function mountDialog(props: Record<string, unknown> = {}) {
  const wrapper = mount(PasswordDeleteDialog, {
    props: {
      modelValue: false,
      title: 'Excluir liga Série A',
      confirmText: 'Excluir liga',
      removed: ['partidas e súmulas', 'estádios da liga'],
      kept: 'Times e usuários continuam no sistema.',
      request,
      ...props,
    },
    slots: { default: '<p>Detalhe extra do aviso</p>' },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  return wrapper
}

function dialogText(): string {
  return document.querySelector('[data-test="password-delete-dialog"]')?.textContent ?? ''
}

function button(selector: string) {
  return document.querySelector(selector) as HTMLButtonElement
}

function click(selector: string) {
  button(selector).click()
  return flushPromises()
}

async function typePassword(value: string) {
  const input = document.querySelector(
    '[data-test="password-delete-password"] input',
  ) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function goToPasswordStep() {
  const wrapper = await mountDialog()
  await click('[data-test="password-delete-continue"]')
  await typePassword('senha-do-master')
  return wrapper
}

describe('PasswordDeleteDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    request.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('primeiro avisa o que será apagado e o que fica, sem pedir a senha', async () => {
    await mountDialog()

    const text = dialogText()
    expect(text).toContain('Excluir liga Série A')
    expect(text).toContain('A exclusão é imediata e não pode ser desfeita.')
    expect(text).toContain('Detalhe extra do aviso')
    expect(
      [...document.querySelectorAll('[data-test="password-delete-removed"] li')].map(
        (item) => item.textContent,
      ),
    ).toEqual(['partidas e súmulas', 'estádios da liga'])
    expect(text).toContain('Times e usuários continuam no sistema.')
    expect(document.querySelector('[data-test="password-delete-password"]')).toBeNull()
  })

  it('aviso próprio substitui o padrão', async () => {
    await mountDialog({ warning: 'Não depende do botão Salvar.' })

    expect(dialogText()).toContain('Não depende do botão Salvar.')
    expect(dialogText()).not.toContain('não pode ser desfeita')
  })

  it('com o aviso carregando, não deixa continuar', async () => {
    await mountDialog({ loading: true })

    expect(button('[data-test="password-delete-continue"]').disabled).toBe(true)
  })

  it('no segundo passo chama o request com a senha e avisa quem abriu', async () => {
    request.mockResolvedValue(undefined)
    const wrapper = await goToPasswordStep()

    expect(button('[data-test="password-delete-confirm"]').textContent?.trim()).toBe('Excluir liga')
    await click('[data-test="password-delete-confirm"]')

    expect(request).toHaveBeenCalledWith('senha-do-master')
    expect(wrapper.emitted('deleted')).toEqual([[]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('senha errada (422) mostra errors.password[0] e mantém o diálogo aberto', async () => {
    request.mockRejectedValue(apiError(422, 'Senha incorreta.', { password: ['Senha incorreta.'] }))
    const wrapper = await goToPasswordStep()

    await click('[data-test="password-delete-confirm"]')

    expect(dialogText()).toContain('Senha incorreta.')
    expect(wrapper.emitted('deleted')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('excesso de tentativas (429) pede para aguardar', async () => {
    request.mockRejectedValue(apiError(429, 'Too Many Attempts.'))
    await goToPasswordStep()

    await click('[data-test="password-delete-confirm"]')

    expect(dialogText()).toContain('Muitas tentativas. Aguarde um minuto.')
  })

  it('não envia sem senha e reabre no primeiro passo', async () => {
    const wrapper = await mountDialog()
    await click('[data-test="password-delete-continue"]')

    expect(button('[data-test="password-delete-confirm"]').disabled).toBe(true)
    expect(request).not.toHaveBeenCalled()

    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(document.querySelector('[data-test="password-delete-password"]')).toBeNull()
  })
})
