import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionCard from '@/components/common/ActionCard.vue'
import { createTestVuetify } from '@/test/utils'

function mountCard(props: Record<string, unknown> = {}) {
  return mount(ActionCard, {
    props: { icon: 'mdi-card', label: 'Cartão amarelo', color: 'card-yellow', ...props },
    global: { plugins: [createTestVuetify()] },
  })
}

describe('ActionCard', () => {
  it('é um botão com o nome, o ícone e o avatar tonal na cor do tipo', async () => {
    const wrapper = mountCard()

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toBe('Cartão amarelo')
    expect(wrapper.find('.v-icon').classes()).toContain('mdi-card')
    const avatar = wrapper.find('.v-avatar')
    expect(avatar.classes()).toContain('v-avatar--variant-tonal')
    expect(avatar.classes()).toContain('text-card-yellow')

    await button.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('sem cor usa primary', () => {
    const wrapper = mountCard({ color: undefined })
    expect(wrapper.find('.v-avatar').classes()).toContain('text-primary')
  })

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ])('%s não emite clique e fica fora do tab', async (_label, props) => {
    const wrapper = mountCard(props)

    const button = wrapper.find('button')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('tabindex')).toBe('-1')
    await button.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('loading mostra a barra de progresso e marca aria-busy', () => {
    const wrapper = mountCard({ loading: true })
    expect(wrapper.find('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.v-progress-linear').exists()).toBe(true)
  })

  it.each([375, 600, 960])('em %ipx o ícone fica em cima do nome, centralizado', (width) => {
    window.innerWidth = width
    const wrapper = mountCard()
    window.innerWidth = 1024

    expect(wrapper.find('.v-card-text').classes()).toEqual(
      expect.arrayContaining(['flex-column', 'text-center']),
    )
  })

  it('no desktop o ícone fica ao lado do nome', () => {
    window.innerWidth = 1366
    const wrapper = mountCard()
    window.innerWidth = 1024

    expect(wrapper.find('.v-card-text').classes()).not.toContain('flex-column')
  })
})
