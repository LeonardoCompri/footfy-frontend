import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'
import { createTestVuetify } from '@/test/utils'

function mountImage(src: string | null) {
  return mount(ChampionshipImage, {
    props: { src, height: 140, width: 56, rounded: 'lg' },
    slots: {
      default: '<div data-test="fallback">Sem imagem</div>',
      overlay: '<button data-test="overlay">Trocar</button>',
    },
    global: { plugins: [createTestVuetify()] },
  })
}

describe('ChampionshipImage', () => {
  it('com src mostra a cópia desfocada atrás (cover) e a imagem inteira na frente (contain)', () => {
    const wrapper = mountImage('http://api/copa.png')

    const [backdrop, front] = wrapper.findAllComponents({ name: 'VImg' })
    expect(backdrop.props()).toMatchObject({
      src: 'http://api/copa.png',
      cover: true,
      imageClass: 'championship-image__backdrop',
      height: 140,
      width: 56,
      rounded: 'lg',
    })
    expect(backdrop.classes()).toContain('bg-surface-variant')
    expect(front.props()).toMatchObject({ src: 'http://api/copa.png', cover: false })
    expect(front.attributes('data-test')).toBe('championship-image-front')
    expect(front.find('[data-test="overlay"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="fallback"]').exists()).toBe(false)
  })

  it('sem src mostra só o fallback do slot default', () => {
    const wrapper = mountImage(null)

    expect(wrapper.findAllComponents({ name: 'VImg' })).toHaveLength(0)
    expect(wrapper.find('[data-test="fallback"]').text()).toBe('Sem imagem')
    expect(wrapper.find('[data-test="overlay"]').exists()).toBe(false)
  })
})
