import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CpfTextField from '@/components/common/CpfTextField.vue'
import { createTestVuetify } from '@/test/utils'

function mountField(modelValue: string | null = '', required = false) {
  const wrapper = mount(CpfTextField, {
    props: {
      modelValue,
      required,
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

// Simula uma edição do navegador: texto resultante, posição do cursor e tipo da edição.
async function edit(wrapper: ReturnType<typeof mountField>, value: string, caret: number, inputType = 'insertText') {
  const input = wrapper.find('input').element as HTMLInputElement
  input.value = value
  input.setSelectionRange(caret, caret)
  input.dispatchEvent(new InputEvent('input', { inputType }))
  await flushPromises()
  return input
}

function errors(wrapper: ReturnType<typeof mountField>) {
  return (wrapper.findComponent({ name: 'VTextField' }).vm as unknown as { validate: () => Promise<string[]> }).validate()
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

  it('mantém o cursor no lugar ao inserir um dígito no meio', async () => {
    const wrapper = mountField('123456')

    const input = await edit(wrapper, '1293.456', 3)

    expect(input.value).toBe('129.345.6')
    expect(input.selectionStart).toBe(3)
    expect(wrapper.props('modelValue')).toBe('1293456')
  })

  it('backspace logo depois de um separador apaga o dígito anterior', async () => {
    const wrapper = mountField('12345678901')

    // Cursor depois do primeiro "."; o navegador remove só o separador.
    const input = await edit(wrapper, '123456.789-01', 3, 'deleteContentBackward')

    expect(wrapper.props('modelValue')).toBe('1245678901')
    expect(input.value).toBe('124.567.890-1')
    expect(input.selectionStart).toBe(2)
  })

  it('delete logo antes de um separador apaga o dígito seguinte', async () => {
    const wrapper = mountField('12345678901')

    const input = await edit(wrapper, '123456.789-01', 3, 'deleteContentForward')

    expect(wrapper.props('modelValue')).toBe('1235678901')
    expect(input.value).toBe('123.567.890-1')
    expect(input.selectionStart).toBe(3)
  })

  it('recusa um dígito a mais no meio de um CPF completo, sem cortar o fim', async () => {
    const wrapper = mountField('12345678901')

    const input = await edit(wrapper, '1293.456.789-01', 3)

    expect(input.value).toBe('123.456.789-01')
    expect(input.selectionStart).toBe(2)
    expect(wrapper.props('modelValue')).toBe('12345678901')
  })

  it('normaliza para só dígitos um CPF recebido com pontuação', async () => {
    // Monta sem o helper: a normalização emite já na montagem.
    const wrapper = mount(CpfTextField, {
      props: { modelValue: '123.456.789-01' },
      global: { plugins: [createTestVuetify()] },
    })
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['12345678901'])
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('123.456.789-01')
  })

  it('valida 11 dígitos e só exige o campo quando required', async () => {
    const optional = mountField('')
    expect(await errors(optional)).toEqual([])
    await optional.setProps({ modelValue: '1234' })
    expect(await errors(optional)).toEqual(['O CPF deve ter 11 dígitos.'])

    const required = mountField('', true)
    expect(await errors(required)).toEqual(['Campo obrigatório.'])
    await required.setProps({ modelValue: '12345678901' })
    expect(await errors(required)).toEqual([])
  })
})
