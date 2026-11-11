import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChampionshipFormView from '@/views/admin/championships/ChampionshipFormView.vue'
import { championshipsService } from '@/services/api/championships.service'
import { leaguesService } from '@/services/api/leagues.service'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { Championship } from '@/types/championship'
import {
  championshipA,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
} from '@/test/utils'
import { apiError } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/championships.service', () => ({
  championshipsService: { get: vi.fn(), create: vi.fn(), update: vi.fn(), list: vi.fn() },
}))
vi.mock('@/services/api/leagues.service', () => ({
  leaguesService: { list: vi.fn(), removeWithPassword: vi.fn() },
}))

const service = vi.mocked(championshipsService)
const leagues = vi.mocked(leaguesService)

function savedChampionship(): Championship {
  return {
    ...championshipA,
    id: 5,
    leagues: [
      makeLeague(7, championshipA, { name: 'Série A', season: '2026', format: 'round_robin' }),
      makeLeague(8, championshipA, {
        name: 'Série B',
        format: 'knockout',
        start_date: '2026-03-01',
        end_date: '2026-11-29',
      }),
    ],
  }
}

async function mountForm(id?: string) {
  const router = createTestRouter()
  await router.push(id ? `/admin/campeonatos/${id}/editar` : '/admin/campeonatos/novo')
  const wrapper = mount(ChampionshipFormView, {
    props: id ? { id } : {},
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return Object.assign(wrapper, { router })
}

function panels(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="league-panel"]')
}

function panelTitles(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="league-panel-title"]').map((title) => title.text())
}

async function chooseImage(wrapper: VueWrapper, file: File) {
  const input = wrapper.find('[data-test="championship-image-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

function previewSrc(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: 'VImg' }).props('src')
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('ChampionshipFormView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = makeUser('master')
    service.create.mockResolvedValue({ ...championshipA, id: 5 })
    service.update.mockResolvedValue({ ...championshipA, id: 5 })
    service.get.mockResolvedValue(savedChampionship())
    service.list.mockResolvedValue([])
    leagues.list.mockResolvedValue([])
    URL.createObjectURL = vi.fn(() => 'blob:nova-imagem')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('salva um campeonato sem ligas e recarrega o contexto de liga', async () => {
    const wrapper = await mountForm()
    expect(wrapper.find('[data-test="leagues-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="leagues-count"]').text()).toBe('0')

    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await submit(wrapper)

    expect(service.create).toHaveBeenCalledWith({
      name: 'Copa Nova',
      image: null,
      removeImage: false,
      leagues: [],
    })
    expect(leagues.list).toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(wrapper.router.currentRoute.value.name).toBe('admin-championships-list'),
    )
  })

  it('adiciona e remove ligas novas sem diálogo, e só envia as que ficaram', async () => {
    const wrapper = await mountForm()

    await wrapper.find('[data-test="league-add"]').trigger('click')
    await wrapper.find('[data-test="league-add"]').trigger('click')
    expect(panels(wrapper)).toHaveLength(2)
    expect(wrapper.find('[data-test="leagues-count"]').text()).toBe('2')
    expect(panelTitles(wrapper)).toEqual(['Nova liga', 'Nova liga'])

    const names = wrapper.findAll('[data-test="league-name"] input')
    await names[0].setValue('Descartada')
    await names[1].setValue('Série Ouro')
    await panels(wrapper)[0].find('[data-test="league-remove"]').trigger('click')
    await flushPromises()

    expect(panelTitles(wrapper)).toEqual(['Série Ouro'])
    expect(document.querySelector('.v-dialog.v-overlay--active')).toBeNull()

    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await submit(wrapper)

    expect(service.create).toHaveBeenCalledOnce()
    const payload = service.create.mock.calls[0][0]
    expect(payload.leagues).toHaveLength(1)
    expect(payload.leagues![0]).toMatchObject({
      id: undefined,
      name: 'Série Ouro',
      format: 'round_robin',
      season: null,
    })
  })

  it('na edição carrega as ligas e mostra "Abrir painel da liga" só nas já salvas', async () => {
    const wrapper = await mountForm('5')

    expect(panelTitles(wrapper)).toEqual(['Série A', 'Série B'])
    expect(panels(wrapper)[0].text()).toContain('Pontos corridos · Temporada 2026')

    await wrapper.find('[data-test="league-add"]').trigger('click')

    const rows = panels(wrapper)
    expect(rows.map((row) => row.find('[data-test="league-open"]').exists())).toEqual([
      true,
      true,
      false,
    ])
    expect(rows[0].find('[data-test="league-open"]').attributes('href')).toBe('/admin/liga/7')
  })

  it('edição envia as ligas com id e a nova sem id', async () => {
    const wrapper = await mountForm('5')
    await wrapper.find('[data-test="league-add"]').trigger('click')
    await wrapper.findAll('[data-test="league-name"] input')[2].setValue('Série C')

    await submit(wrapper)

    const [id, payload] = service.update.mock.calls[0]
    expect(id).toBe('5')
    expect(payload.leagues!.map((league) => [league.id, league.name])).toEqual([
      [7, 'Série A'],
      [8, 'Série B'],
      [undefined, 'Série C'],
    ])
    expect(payload.leagues![1]).toMatchObject({ start_date: '2026-03-01', end_date: '2026-11-29' })
  })

  it('erro 422 leagues.N.campo aparece no campo do painel N, que é aberto', async () => {
    service.update.mockRejectedValue(
      apiError(422, 'Dados inválidos.', {
        'leagues.1.end_date': ['A data de término deve ser posterior à data de início.'],
      }),
    )
    const wrapper = await mountForm('5')
    expect(wrapper.findAll('.v-expansion-panel--active')).toHaveLength(0)

    await submit(wrapper)

    const rows = panels(wrapper)
    expect(rows[1].classes()).toContain('v-expansion-panel--active')
    expect(rows[0].classes()).not.toContain('v-expansion-panel--active')
    expect(rows[1].find('[data-test="league-end-date"]').text()).toContain(
      'A data de término deve ser posterior à data de início.',
    )
    expect(rows[0].find('[data-test="league-end-date"]').text()).not.toContain('posterior')
    expect(wrapper.router.currentRoute.value.name).toBe('admin-championships-edit')
  })

  it('erro 422 do limite de jogadores aparece no alerta do formulário', async () => {
    const message = 'O time Vitória tem 32 atletas, acima do limite da liga.'
    service.update.mockRejectedValue(
      apiError(422, message, { 'leagues.0.max_players_per_team': [message] }),
    )
    const wrapper = await mountForm('5')

    await submit(wrapper)

    expect(wrapper.find('.v-alert').text()).toContain(message)
  })

  it('erro 422 leagues.N.id aparece no topo do painel N', async () => {
    service.update.mockRejectedValue(
      apiError(422, 'Dados inválidos.', {
        'leagues.0.id': ['A liga não pertence a este campeonato.'],
      }),
    )
    const wrapper = await mountForm('5')

    await submit(wrapper)

    const rows = panels(wrapper)
    expect(rows[0].classes()).toContain('v-expansion-panel--active')
    expect(rows[0].find('[data-test="league-error"]').text()).toBe(
      'A liga não pertence a este campeonato.',
    )
    expect(rows[1].find('[data-test="league-error"]').exists()).toBe(false)
  })

  it('edição sem tocar na imagem salva não envia arquivo nem pede a remoção', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const wrapper = await mountForm('5')

    await submit(wrapper)

    expect(service.update.mock.calls[0][1]).toMatchObject({ image: null, removeImage: false })
  })

  it('sem imagem mostra a zona de envio e "Visualizar aplicação" desabilitado', async () => {
    const wrapper = await mountForm()

    expect(wrapper.find('[data-test="championship-image-empty"]').text()).toBe(
      'Clique para enviar a imagem',
    )
    expect(wrapper.find('[data-test="championship-image-preview"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-test="championship-image-input"]').attributes('hidden'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-test="championship-image-preview-open"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('a zona de envio e o botão "Trocar imagem" abrem o seletor de arquivo', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const empty = await mountForm()
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    await empty.find('[data-test="championship-image-empty"]').trigger('click')
    expect(click).toHaveBeenCalledTimes(1)
    empty.unmount()

    const editing = await mountForm('5')
    const change = editing.find('[data-test="championship-image-change"]')
    expect(change.attributes('aria-label')).toBe('Trocar imagem')
    await change.trigger('click')
    expect(click).toHaveBeenCalledTimes(2)
    click.mockRestore()
  })

  it('imagem escolhida no input oculto vira a prévia e vai no payload', async () => {
    const wrapper = await mountForm()
    const file = new File(['png'], 'copa.png', { type: 'image/png' })

    await chooseImage(wrapper, file)

    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(previewSrc(wrapper)).toBe('blob:nova-imagem')
    expect(wrapper.find('[data-test="championship-image-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="championship-image-remove"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-test="championship-image-preview-open"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await submit(wrapper)

    expect(service.create.mock.calls[0][0].image).toBe(file)
  })

  it('lixeira na imagem salva volta para a zona de envio e pede a remoção (BUG-037)', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const wrapper = await mountForm('5')
    expect(previewSrc(wrapper)).toBe('http://api/copa.png')
    const remove = wrapper.find('[data-test="championship-image-remove"]')
    expect(remove.attributes('aria-label')).toBe('Remover imagem')

    await remove.trigger('click')

    expect(wrapper.find('[data-test="championship-image-preview"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="championship-image-empty"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-test="championship-image-preview-open"]').attributes('disabled'),
    ).toBeDefined()
    await submit(wrapper)
    expect(service.update.mock.calls[0][1]).toMatchObject({ image: null, removeImage: true })
  })

  it('lixeira na imagem nova escolhida sobre a salva deixa o campeonato sem imagem', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const wrapper = await mountForm('5')
    await chooseImage(wrapper, new File(['png'], 'nova.png', { type: 'image/png' }))
    expect(previewSrc(wrapper)).toBe('blob:nova-imagem')

    await wrapper.find('[data-test="championship-image-remove"]').trigger('click')

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:nova-imagem')
    expect(wrapper.find('[data-test="championship-image-empty"]').exists()).toBe(true)
    await submit(wrapper)
    expect(service.update.mock.calls[0][1]).toMatchObject({ image: null, removeImage: true })
  })

  it('depois da lixeira, uma imagem escolhida de novo é a que vale', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const wrapper = await mountForm('5')
    await wrapper.find('[data-test="championship-image-remove"]').trigger('click')
    const file = new File(['png'], 'outra.png', { type: 'image/png' })

    await chooseImage(wrapper, file)

    expect(previewSrc(wrapper)).toBe('blob:nova-imagem')
    await submit(wrapper)
    expect(service.update.mock.calls[0][1].image).toBe(file)
  })

  it('lixeira na imagem nova de um campeonato novo só descarta a escolha', async () => {
    const wrapper = await mountForm()
    await chooseImage(wrapper, new File(['png'], 'nova.png', { type: 'image/png' }))

    await wrapper.find('[data-test="championship-image-remove"]').trigger('click')

    expect(wrapper.find('[data-test="championship-image-empty"]').exists()).toBe(true)
    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await submit(wrapper)
    expect(service.create.mock.calls[0][0]).toMatchObject({ image: null, removeImage: false })
  })

  it('erro 422 da imagem aparece abaixo da área da imagem', async () => {
    service.create.mockRejectedValue(
      apiError(422, 'Dados inválidos.', { image: ['A imagem deve ter no máximo 2 MB.'] }),
    )
    const wrapper = await mountForm()
    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await chooseImage(wrapper, new File(['png'], 'grande.png', { type: 'image/png' }))

    await submit(wrapper)

    expect(wrapper.find('[data-test="championship-image-error"]').text()).toBe(
      'A imagem deve ter no máximo 2 MB.',
    )
  })

  it('o seletor aceita só JPG, PNG e WebP e a ajuda explica o formato', async () => {
    const wrapper = await mountForm()

    expect(wrapper.find('[data-test="championship-image-input"]').attributes('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    )
    expect(wrapper.find('[data-test="championship-image-help"]').text()).toContain(
      'JPG, PNG ou WebP até 2 MB. Ideal: logo ou arte horizontal (ex.: 1600×800). A imagem aparece inteira em todos os lugares',
    )
  })

  it.each([
    [
      'tipo fora da lista',
      new File(['gif'], 'copa.gif', { type: 'image/gif' }),
      'Use uma imagem JPG, PNG ou WebP.',
    ],
    [
      'arquivo acima de 2 MB',
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }),
      'A imagem deve ter no máximo 2 MB.',
    ],
  ])('%s não entra na prévia e mostra o erro', async (_, file, message) => {
    const wrapper = await mountForm()

    await chooseImage(wrapper, file)

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="championship-image-preview"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="championship-image-error"]').text()).toBe(message)

    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await submit(wrapper)
    expect(service.create.mock.calls[0][0].image).toBeNull()
  })

  it('arquivo inválido mantém a imagem anterior e um válido (2 MB) limpa o erro', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const wrapper = await mountForm('5')

    await chooseImage(wrapper, new File(['gif'], 'copa.gif', { type: 'image/gif' }))
    expect(previewSrc(wrapper)).toBe('http://api/copa.png')
    expect(wrapper.find('[data-test="championship-image-error"]').exists()).toBe(true)

    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'limite.webp', { type: 'image/webp' })
    await chooseImage(wrapper, file)

    expect(previewSrc(wrapper)).toBe('blob:nova-imagem')
    expect(wrapper.find('[data-test="championship-image-error"]').exists()).toBe(false)
    await submit(wrapper)
    expect(service.update.mock.calls[0][1].image).toBe(file)
  })

  it('"Visualizar aplicação" abre o diálogo com a imagem, o nome e a primeira liga', async () => {
    service.get.mockResolvedValue({ ...savedChampionship(), image: 'http://api/copa.png' })
    const wrapper = await mountForm('5')

    await wrapper.find('[data-test="championship-image-preview-open"]').trigger('click')
    await flushPromises()

    const dialog = document.querySelector('.v-dialog.v-overlay--active')
    expect(dialog?.textContent).toContain('Como a imagem aparece')
    expect(dialog?.textContent).toContain('Série A')
    expect(dialog?.textContent).toContain('Brasileiro')
    expect(wrapper.findComponent({ name: 'ChampionshipImagePreviewDialog' }).props('image')).toBe(
      'http://api/copa.png',
    )
  })

  it('valida no front a data de término antes da de início e abre o painel', async () => {
    const wrapper = await mountForm('5')
    await panels(wrapper)[1].find('[data-test="league-end-date"] input').setValue('2026-02-01')

    await submit(wrapper)

    expect(service.update).not.toHaveBeenCalled()
    expect(panels(wrapper)[1].classes()).toContain('v-expansion-panel--active')
    expect(panels(wrapper)[1].text()).toContain(
      'A data de término deve ser depois da data de início.',
    )
  })

  it('valida no front o nome da liga obrigatório', async () => {
    const wrapper = await mountForm()
    await wrapper.find('[data-test="championship-name"] input').setValue('Copa Nova')
    await wrapper.find('[data-test="league-add"]').trigger('click')

    await submit(wrapper)

    expect(service.create).not.toHaveBeenCalled()
    expect(panels(wrapper)[0].text()).toContain('Informe o nome.')
  })

  it('excluir liga salva abre o diálogo e, no sucesso, tira a liga e limpa o contexto se era a ativa', async () => {
    leagues.removeWithPassword.mockResolvedValue({} as never)
    const context = useLeagueContextStore()
    context.setActiveLeague(7)
    const wrapper = await mountForm('5')
    leagues.list.mockClear()

    await panels(wrapper)[0].find('[data-test="league-remove"]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('.v-dialog.v-overlay--active')
    expect(dialog?.textContent).toContain('Excluir liga Série A')
    ;(document.querySelector('[data-test="password-delete-continue"]') as HTMLButtonElement).click()
    await flushPromises()
    const password = document.querySelector(
      '[data-test="password-delete-password"] input',
    ) as HTMLInputElement
    password.value = 'senha'
    password.dispatchEvent(new Event('input'))
    await flushPromises()
    ;(document.querySelector('[data-test="password-delete-confirm"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(leagues.removeWithPassword).toHaveBeenCalledWith(7, 'senha')
    expect(panelTitles(wrapper)).toEqual(['Série B'])
    expect(useSnackbar().message.value).toBe('Liga excluída com sucesso.')
    expect(context.activeLeagueId).toBeNull()
    expect(localStorage.getItem('footfy_active_league')).toBeNull()
    expect(leagues.list).toHaveBeenCalled()
    expect(service.update).not.toHaveBeenCalled()
  })

  it('excluir outra liga mantém a liga ativa do contexto', async () => {
    leagues.removeWithPassword.mockResolvedValue({} as never)
    const context = useLeagueContextStore()
    context.setActiveLeague(8)
    const wrapper = await mountForm('5')

    await panels(wrapper)[0].find('[data-test="league-remove"]').trigger('click')
    wrapper.findComponent({ name: 'PasswordDeleteDialog' }).vm.$emit('deleted')
    await flushPromises()

    expect(panelTitles(wrapper)).toEqual(['Série B'])
    expect(context.activeLeagueId).toBe(8)
  })
})
