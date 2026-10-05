import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FormDialog from '@/components/common/FormDialog.vue'
import { createTestVuetify } from '@/test/utils'

async function mountDialog() {
  const wrapper = mount(FormDialog, {
    props: { modelValue: true, title: 'Novo usuário' },
    slots: { default: '<input data-test="field" />' },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('FormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // Ações fora da área rolável: não se movem quando um campo muda de altura no blur (FOOT-0024).
  it('só o conteúdo rola; as ações ficam fixas no rodapé do card', async () => {
    await mountDialog()

    const form = document.querySelector('.v-overlay--active .v-card > form') as HTMLElement
    expect(form.classList).toContain('form-dialog__form')
    const [content, , actions] = [...form.children]
    expect(content.getAttribute('data-test')).toBe('form-content')
    expect(content.classList).toContain('form-dialog__content')
    expect(content.querySelector('[data-test="field"]')).not.toBeNull()
    expect(actions.getAttribute('data-test')).toBe('form-actions')
    expect(actions.contains(document.querySelector('[data-test="form-submit"]'))).toBe(true)
  })

  it('Salvar emite submit', async () => {
    const wrapper = await mountDialog()

    ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
