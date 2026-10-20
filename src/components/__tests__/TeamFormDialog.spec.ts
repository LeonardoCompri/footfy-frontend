import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamFormDialog from '@/components/teams/TeamFormDialog.vue'
import { teamsService } from '@/services/api/teams.service'
import { createTestVuetify } from '@/test/utils'
import { apiError, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: { create: vi.fn(), update: vi.fn(), attachLeagues: vi.fn() },
}))

async function mountDialog(team: ReturnType<typeof makeTeam> | null = null) {
  const wrapper = mount(TeamFormDialog, {
    props: { modelValue: true, leagueId: 3, team },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function logoLabel(): string | undefined {
  return document
    .querySelector('.v-overlay--active .v-file-input .v-field-label:not(.v-field-label--floating)')
    ?.textContent?.trim()
}

function logoPreviewSrc(): string | null {
  return document.querySelector('[data-test="team-logo-preview"] img')?.getAttribute('src') ?? null
}

async function selectLogo(wrapper: Awaited<ReturnType<typeof mountDialog>>, file: File) {
  wrapper.findComponent({ name: 'VFileInput' }).vm.$emit('update:modelValue', file)
  await flushPromises()
}

async function setName(value: string) {
  const input = document.querySelector('[data-test="team-name"] input') as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('TeamFormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:novo-escudo')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('exibe o upload rotulado "Escudo" sem preview ao criar', async () => {
    await mountDialog()

    expect(logoLabel()).toBe('Escudo')
    expect(logoPreviewSrc()).toBeNull()
  })

  it('pré-carrega o escudo atual ao editar', async () => {
    await mountDialog(makeTeam(7, 'Time A', { logo: 'http://api/storage/teams/a.png' }))

    expect(logoLabel()).toBe('Trocar escudo')
    expect(logoPreviewSrc()).toBe('http://api/storage/teams/a.png')
  })

  it('mostra o preview da imagem selecionada antes de salvar', async () => {
    const wrapper = await mountDialog(makeTeam(7, 'Time A', { logo: 'http://api/storage/teams/a.png' }))
    const file = new File(['x'], 'escudo.png', { type: 'image/png' })

    await selectLogo(wrapper, file)

    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(logoPreviewSrc()).toBe('blob:novo-escudo')

    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:novo-escudo')
  })

  it('cria o time enviando o escudo e a liga atual', async () => {
    const created = makeTeam(30, 'Novo Time', { leagues: [{ id: 3, name: 'Liga 3' }] })
    vi.mocked(teamsService.create).mockResolvedValue(created)
    const wrapper = await mountDialog()
    const file = new File(['x'], 'escudo.png', { type: 'image/png' })

    await setName('Novo Time')
    await selectLogo(wrapper, file)
    await submit()

    expect(teamsService.create).toHaveBeenCalledWith({
      name: 'Novo Time',
      nickname: null,
      logo: file,
      league_ids: [3],
    })
    expect(teamsService.attachLeagues).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')?.[0]).toEqual([created])
  })

  it('mantém o dialog aberto com a mensagem do backend quando a liga não é acessível', async () => {
    vi.mocked(teamsService.create).mockRejectedValue(
      apiError(422, 'Você não tem acesso a uma ou mais ligas informadas.', {
        'league_ids.0': ['Você não tem acesso a uma ou mais ligas informadas.'],
      }),
    )
    const wrapper = await mountDialog()

    await setName('Novo Time')
    await submit()

    expect(document.querySelector('[data-test="form-error"]')?.textContent).toContain(
      'Você não tem acesso a uma ou mais ligas informadas.',
    )
    expect(document.querySelector('.v-overlay--active [data-test="team-name"]')).not.toBeNull()
    expect(wrapper.emitted('saved')).toBeUndefined()
    const closed = wrapper.emitted('update:modelValue')?.some(([open]) => open === false)
    expect(closed ?? false).toBe(false)
  })

  it('edita sem trocar o escudo enviando logo nulo (mantém o existente)', async () => {
    const team = makeTeam(7, 'Time A', { logo: 'http://api/storage/teams/a.png' })
    vi.mocked(teamsService.update).mockResolvedValue(team)
    const wrapper = await mountDialog(team)

    await submit()

    expect(teamsService.update).toHaveBeenCalledWith(7, { name: 'Time A', nickname: null, logo: null })
    expect(teamsService.attachLeagues).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')?.[0]).toEqual([team])
  })
})
