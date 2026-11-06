import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChampionshipImagePreviewDialog from '@/components/championships/ChampionshipImagePreviewDialog.vue'
import { createTestVuetify } from '@/test/utils'

async function mountDialog() {
  const wrapper = mount(ChampionshipImagePreviewDialog, {
    props: {
      modelValue: true,
      image: 'blob:nova-imagem',
      name: 'Copa Footfy',
      leagueName: 'Série A',
    },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function imageSize(selector: string) {
  const dialog = document.querySelector('[data-test="image-preview-dialog"]')!
  const img = dialog.querySelector(`${selector} .v-img`) as HTMLElement
  return { height: img.style.height, width: img.style.width }
}

describe('ChampionshipImagePreviewDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mostra a imagem inteira, nos tamanhos das telas reais', async () => {
    const wrapper = await mountDialog()

    expect(imageSize('[data-test="preview-banner"]')).toEqual({ height: '200px', width: '' })
    expect(imageSize('[data-test="preview-public-card"]')).toEqual({ height: '160px', width: '' })
    expect(imageSize('[data-test="preview-select-card"]')).toEqual({ height: '140px', width: '' })
    expect(imageSize('[data-test="preview-dashboard"]')).toEqual({ height: '56px', width: '56px' })

    const images = wrapper.findAllComponents({ name: 'ChampionshipImage' })
    expect(images.map((image) => image.props('src'))).toEqual(Array(4).fill('blob:nova-imagem'))
    expect(document.querySelector('[data-test="image-preview-dialog"]')?.textContent).toContain(
      'A imagem aparece inteira em todos os lugares',
    )

    const dashboard = document.querySelector('[data-test="preview-dashboard"]')!
    expect(dashboard.textContent).toContain('Série A')
    expect(dashboard.textContent).toContain('Copa Footfy')
    expect(document.querySelector('[data-test="preview-banner"]')?.textContent).toContain(
      'Copa Footfy',
    )
  })

  it('Fechar emite update:modelValue false', async () => {
    const wrapper = await mountDialog()

    ;(document.querySelector('[data-test="image-preview-close"]') as HTMLButtonElement).click()

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
