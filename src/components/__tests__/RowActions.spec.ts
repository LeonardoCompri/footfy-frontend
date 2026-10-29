import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
import { createTestVuetify } from '@/test/utils'

function makeActions() {
  return [
    { key: 'edit', icon: 'mdi-pencil', label: 'Editar', dataTest: 'edit', onClick: vi.fn() },
    {
      key: 'delete',
      icon: 'mdi-delete',
      label: 'Excluir',
      color: 'error',
      dataTest: 'delete',
      onClick: vi.fn(),
    },
  ] satisfies RowAction[]
}

// `width` antes do mount: o useDisplay lê a largura quando o Vuetify é criado.
function mountActions(actions: RowAction[], width: number) {
  window.innerWidth = width
  return mount(RowActions, {
    props: { actions, menuLabel: 'Ações de Fulano' },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
}

const menuItems = () =>
  [...document.querySelectorAll('.v-overlay--active .v-list-item')] as HTMLElement[]

describe('RowActions', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.innerWidth = 1366
  })

  it.each([1366, 375])('sem ações não renderiza nada (largura %i)', (width) => {
    const wrapper = mountActions([], width)

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it.each([1366, 375])('com uma ação mostra o botão direto (largura %i)', async (width) => {
    const [edit] = makeActions()
    const wrapper = mountActions([edit], width)

    expect(wrapper.find('[data-test="row-actions-menu"]').exists()).toBe(false)
    const button = wrapper.find('[data-test="edit"]')
    expect(button.attributes('aria-label')).toBe('Editar')
    await button.trigger('click')
    expect(edit.onClick).toHaveBeenCalledOnce()
  })

  it('sm+: várias ações viram botões de ícone na linha', async () => {
    const actions = makeActions()
    const wrapper = mountActions(actions, 1366)

    expect(wrapper.find('[data-test="row-actions-menu"]').exists()).toBe(false)
    expect(wrapper.findAll('button').map((b) => b.attributes('aria-label'))).toEqual([
      'Editar',
      'Excluir',
    ])
    expect(wrapper.find('[data-test="delete"]').classes()).toContain('text-error')
    await wrapper.find('[data-test="delete"]').trigger('click')
    expect(actions[1].onClick).toHaveBeenCalledOnce()
    expect(actions[0].onClick).not.toHaveBeenCalled()
  })

  it('xs: várias ações ficam num menu com ícone e texto', async () => {
    const actions = makeActions()
    const wrapper = mountActions(actions, 375)

    expect(wrapper.find('[data-test="edit"]').exists()).toBe(false)
    const toggle = wrapper.find('[data-test="row-actions-menu"]')
    expect(toggle.attributes('aria-label')).toBe('Ações de Fulano')
    await toggle.trigger('click')
    await flushPromises()

    expect(menuItems().map((item) => item.textContent?.trim())).toEqual(['Editar', 'Excluir'])
    expect(menuItems().map((item) => item.dataset.test)).toEqual(['edit', 'delete'])
    expect(menuItems()[1].classList).toContain('text-error')
    menuItems()[1].click()
    await flushPromises()
    expect(actions[1].onClick).toHaveBeenCalledOnce()
    expect(actions[0].onClick).not.toHaveBeenCalled()
  })

  it('xs: item do menu é acionável pelo teclado (Enter)', async () => {
    const actions = makeActions()
    const wrapper = mountActions(actions, 375)

    await wrapper.find('[data-test="row-actions-menu"]').trigger('click')
    await flushPromises()
    menuItems()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(actions[0].onClick).toHaveBeenCalledOnce()
  })
})
