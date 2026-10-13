import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PlayerFormDialog from '@/components/players/PlayerFormDialog.vue'
import { playersService } from '@/services/api/players.service'
import { createTestVuetify } from '@/test/utils'
import { apiError, makePlayer, POSITIONS } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/players.service', () => ({
  playersService: { positions: vi.fn(), create: vi.fn(), update: vi.fn() },
}))

async function mountDialog(player: ReturnType<typeof makePlayer> | null = null) {
  const wrapper = mount(PlayerFormDialog, {
    props: { modelValue: true, teamId: 5, player },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function fieldLabels(): string[] {
  return [...document.querySelectorAll('.v-overlay--active .v-field-label:not(.v-field-label--floating)')].map(
    (l) => l.textContent?.trim() ?? '',
  )
}

async function setInput(selector: string, value: string) {
  const input = document.querySelector(`${selector} input`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('PlayerFormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(playersService.positions).mockResolvedValue(POSITIONS)
  })

  it('não pergunta o time e usa o select de Posição alimentado pelo backend', async () => {
    const wrapper = await mountDialog()

    expect(playersService.positions).toHaveBeenCalled()
    expect(fieldLabels()).toEqual(['Nome', 'Posição', 'Número', 'Data de nascimento', 'CPF'])

    const select = wrapper.findComponent({ name: 'VSelect' })
    expect(select.props('items')).toEqual(POSITIONS)
  })

  it('cria o jogador com team_id implícito do contexto', async () => {
    const created = makePlayer(30, 'Novo Jogador', { team_id: 5 })
    vi.mocked(playersService.create).mockResolvedValue(created)
    const wrapper = await mountDialog()

    await setInput('[data-test="player-name"]', 'Novo Jogador')
    wrapper.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 'GOL')
    await submit()

    expect(playersService.create).toHaveBeenCalledWith({
      team_id: 5,
      name: 'Novo Jogador',
      position: 'GOL',
      number: null,
      birth_date: null,
      document: null,
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([created])
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('envia o CPF só com dígitos, mesmo digitado com máscara', async () => {
    vi.mocked(playersService.create).mockResolvedValue(makePlayer(30, 'Novo Jogador', { team_id: 5 }))
    await mountDialog()

    await setInput('[data-test="player-name"]', 'Novo Jogador')
    await setInput('[data-test="player-document"]', '123.456.789-01')
    expect((document.querySelector('[data-test="player-document"] input') as HTMLInputElement).value).toBe(
      '123.456.789-01',
    )
    await submit()

    expect(playersService.create).toHaveBeenCalledWith(expect.objectContaining({ document: '12345678901' }))
  })

  it('não salva com CPF incompleto (o CPF é opcional, mas se informado precisa de 11 dígitos)', async () => {
    await mountDialog()

    await setInput('[data-test="player-name"]', 'Novo Jogador')
    await setInput('[data-test="player-document"]', '123.456')
    await submit()

    expect(playersService.create).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('O CPF deve ter 11 dígitos.')
  })

  it('edição exibe o CPF cadastrado formatado', async () => {
    await mountDialog(makePlayer(1, 'Antigo', { document: '12345678901' }))

    expect((document.querySelector('[data-test="player-document"] input') as HTMLInputElement).value).toBe(
      '123.456.789-01',
    )
  })

  it('edição mantém posição legada (texto livre) selecionável', async () => {
    const wrapper = await mountDialog(makePlayer(1, 'Antigo', { position: 'Volante' }))

    const items = wrapper.findComponent({ name: 'VSelect' }).props('items') as { value: string }[]
    expect(items.map((i) => i.value)).toEqual(['GOL', 'ATA', 'Volante'])
  })

  it('reflete os erros de validação (422) do backend nos campos', async () => {
    vi.mocked(playersService.create).mockRejectedValue(
      apiError(422, 'O campo nome é obrigatório.', {
        name: ['O campo nome é obrigatório.'],
        document: ['O CPF já está em uso.'],
      }),
    )
    const wrapper = await mountDialog()
    await submit()

    const text = document.body.textContent
    expect(document.querySelector('[data-test="form-error"]')?.textContent).toContain('O campo nome é obrigatório.')
    expect(text).toContain('O CPF já está em uso.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
