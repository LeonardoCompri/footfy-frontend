import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CpfTextField from '@/components/common/CpfTextField.vue'
import { createTestVuetify } from '@/test/utils'

function mountField(modelValue: string | null = '') {
  const wrapper = mount(CpfTextField, {
    props: {
      modelValue,
      'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
    },
    global: { plugins: [createTestVuetify()] },
  })
  return wrapper
}

async function type(wrapper: ReturnType<typeof mountField>, value: string) {
  const input = wrapper.find('input')
  await input.setValue(value)
  await flushPromises()
  return input.element as HTMLInputElement
}

describe('CpfTextField', () => {
  it('exibe o valor inicial formatado', () => {
    const wrapper = mountField('12345678901')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('123.456.789-01')
  })

  it('formata enquanto digita e emite só os dígitos', async () => {
    const wrapper = mountField()

    expect((await type(wrapper, '1234')).value).toBe('123.4')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['1234'])

    expect((await type(wrapper, '123.4567')).value).toBe('123.456.7')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['1234567'])
  })

  it('aceita colar CPF formatado ou só com dígitos', async () => {
    const wrapper = mountField()

    expect((await type(wrapper, '123.456.789-01')).value).toBe('123.456.789-01')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['12345678901'])

    expect((await type(wrapper, '98765432100')).value).toBe('987.654.321-00')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['98765432100'])
  })

  it('descarta letras e o 12º dígito sem deixá-los visíveis', async () => {
    const wrapper = mountField()

    await type(wrapper, '123.456.789-01')
    expect((await type(wrapper, '123.456.789-012')).value).toBe('123.456.789-01')
    expect((await type(wrapper, '123.456.789-01a')).value).toBe('123.456.789-01')
    expect(wrapper.props('modelValue')).toBe('12345678901')
  })

  it('acompanha mudanças externas do v-model', async () => {
    const wrapper = mountField('12345678901')

    await wrapper.setProps({ modelValue: null })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')

    await wrapper.setProps({ modelValue: '98765432100' })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('987.654.321-00')
  })
})
