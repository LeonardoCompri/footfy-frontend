import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AuditLogListView from '@/views/admin/audit/AuditLogListView.vue'
import { auditLogsService } from '@/services/api/auditLogs.service'
import { championshipsService } from '@/services/api/championships.service'
import { leaguesService } from '@/services/api/leagues.service'
import { usersService } from '@/services/api/users.service'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/components/common/format'
import {
  championshipA,
  championshipB,
  createTestRouter,
  createTestVuetify,
  makeLeague,
  makeUser,
} from '@/test/utils'
import { apiError, makeAppUser, makeAuditLog, makePage } from '@/test/factories'
import type { AuditLogListParams } from '@/types/auditLog'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/auditLogs.service', () => ({
  auditLogsService: {
    list: vi.fn(),
    listPaginated: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/services/api/leagues.service', () => ({ leaguesService: { list: vi.fn() } }))
vi.mock('@/services/api/championships.service', () => ({
  championshipsService: { list: vi.fn() },
}))
vi.mock('@/services/api/users.service', () => ({ usersService: { list: vi.fn() } }))

const BASE = { page: 1, per_page: 20 }

const logs = [
  makeAuditLog(2, {
    action: 'draw.round_undone',
    user: { id: 9, name: null },
    created_at: '2026-11-17T15:00:00.000000Z',
  }),
  makeAuditLog(1, {
    action: 'team.merged',
    user: null,
    auditable: { type: 'team', id: 5 },
    league: null,
    championship: { id: 4, name: null },
  }),
]

async function mountView() {
  const auth = useAuthStore()
  auth.token = 'token'
  auth.user = makeUser('master')
  const router = createTestRouter()
  await router.push('/admin/auditoria')
  const wrapper = mount(AuditLogListView, {
    global: { plugins: [createTestVuetify(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function field(wrapper: VueWrapper, name: string, test: string) {
  const found = wrapper.findAllComponents({ name }).find((c) => c.attributes('data-test') === test)
  if (!found) throw new Error(`${name}[data-test=${test}] não encontrado`)
  return found
}

async function choose(wrapper: VueWrapper, name: string, test: string, value: unknown) {
  field(wrapper, name, test).vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function click(wrapper: VueWrapper, test: string) {
  await wrapper.find(`[data-test="${test}"]`).trigger('click')
  await flushPromises()
}

function calls(): AuditLogListParams[] {
  return vi.mocked(auditLogsService.listPaginated).mock.calls.map(([params]) => params)
}

function lastQuery(): AuditLogListParams {
  return vi.mocked(auditLogsService.listPaginated).mock.lastCall![0]
}

function tableRows(wrapper: VueWrapper) {
  return wrapper.findAll('[data-test="audit-table"] tbody tr').map((tr) => tr.text())
}

describe('AuditLogListView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.innerWidth = 1366
    vi.mocked(auditLogsService.listPaginated).mockResolvedValue(
      makePage(logs, { total: 45, last_page: 3 }),
    )
    vi.mocked(leaguesService.list).mockResolvedValue([
      makeLeague(1, championshipA, { name: 'Série A' }),
      makeLeague(2, championshipA, { name: 'Série B' }),
      makeLeague(3, championshipB, { name: 'Copa de Verão' }),
    ])
    vi.mocked(championshipsService.list).mockResolvedValue([championshipA, championshipB])
    vi.mocked(usersService.list).mockResolvedValue([
      makeAppUser(1, 'Ana Master', 'master'),
      makeAppUser(2, 'Bruno Admin', 'admin'),
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no mount busca a 1ª página uma vez, sem filtros, e mostra os registros com rótulos', async () => {
    const wrapper = await mountView()

    expect(calls()).toEqual([BASE])
    expect(usersService.list).not.toHaveBeenCalled()
    const [first, second] = tableRows(wrapper)
    expect(first).toContain(formatDateTime('2026-11-17T15:00:00.000000Z'))
    expect(first).toContain('Rodada desfeita')
    expect(first).toContain('Usuário #9 (excluído)')
    expect(first).toContain('Liga #1')
    expect(first).toContain('Série A')
    expect(first).toContain('Copa Footfy')
    expect(second).toContain('team.merged')
    expect(second).toContain('Sistema')
    expect(second).toContain('Time #5')
    expect(second).toContain('Campeonato #4 (excluído)')
  })

  it('envia todos os filtros preenchidos e volta para a página 1', async () => {
    const wrapper = await mountView()
    await wrapper
      .find('[data-test="audit-table"] button[aria-label="Próxima página"]')
      .trigger('click')
    await flushPromises()
    expect(lastQuery()).toEqual({ ...BASE, page: 2 })

    await choose(wrapper, 'VTextField', 'audit-from', '2026-11-01')
    await choose(wrapper, 'VTextField', 'audit-to', '2026-11-17')
    await choose(wrapper, 'VCombobox', 'audit-action', 'draw.reset')
    await choose(wrapper, 'VAutocomplete', 'audit-championship', 1)
    await choose(wrapper, 'VAutocomplete', 'audit-league', 2)
    await choose(wrapper, 'VSelect', 'audit-type', 'league')
    await choose(wrapper, 'VTextField', 'audit-entity-id', '2')
    expect(calls()).toHaveLength(2)

    await click(wrapper, 'audit-search')

    expect(lastQuery()).toEqual({
      from: '2026-11-01',
      to: '2026-11-17',
      action: 'draw.reset',
      championship_id: 1,
      league_id: 2,
      auditable_type: 'league',
      auditable_id: 2,
      page: 1,
      per_page: 20,
    })
  })

  it('ação digitada à mão (fora da lista) vai como texto livre', async () => {
    const wrapper = await mountView()
    await choose(wrapper, 'VCombobox', 'audit-action', '  game.updated ')
    await click(wrapper, 'audit-search')
    expect(lastQuery()).toEqual({ ...BASE, action: 'game.updated' })
  })

  it('período com a data final antes da inicial mostra erro e não busca', async () => {
    const wrapper = await mountView()
    await choose(wrapper, 'VTextField', 'audit-from', '2026-11-17')
    await choose(wrapper, 'VTextField', 'audit-to', '2026-11-01')

    await click(wrapper, 'audit-search')

    expect(calls()).toHaveLength(1)
    expect(wrapper.text()).toContain('A data final deve ser igual ou posterior à inicial.')

    await choose(wrapper, 'VTextField', 'audit-to', '2026-11-17')
    await click(wrapper, 'audit-search')
    expect(lastQuery()).toEqual({ ...BASE, from: '2026-11-17', to: '2026-11-17' })
    expect(wrapper.text()).not.toContain('A data final deve ser')
  })

  it('ID da entidade só vale com a entidade escolhida e precisa ser inteiro positivo', async () => {
    const wrapper = await mountView()
    expect(field(wrapper, 'VTextField', 'audit-entity-id').props('disabled')).toBe(true)

    await choose(wrapper, 'VSelect', 'audit-type', 'game')
    expect(field(wrapper, 'VTextField', 'audit-entity-id').props('disabled')).toBe(false)
    await choose(wrapper, 'VTextField', 'audit-entity-id', '0')
    await click(wrapper, 'audit-search')
    expect(calls()).toHaveLength(1)
    expect(wrapper.text()).toContain('Informe um número inteiro a partir de 1.')

    await choose(wrapper, 'VSelect', 'audit-type', null)
    expect(field(wrapper, 'VTextField', 'audit-entity-id').props('modelValue')).toBeNull()
    await click(wrapper, 'audit-search')
    expect(calls()).toEqual([BASE, BASE])
    expect(wrapper.text()).not.toContain('Informe um número inteiro')

    await choose(wrapper, 'VSelect', 'audit-type', 'game')
    await click(wrapper, 'audit-search')
    expect(lastQuery()).toEqual({ ...BASE, auditable_type: 'game' })
  })

  it('o campeonato filtra as ligas e limpa a liga de outro campeonato', async () => {
    const wrapper = await mountView()
    const leagueTitles = () =>
      (field(wrapper, 'VAutocomplete', 'audit-league').props('items') as { title: string }[]).map(
        (item) => item.title,
      )
    expect(leagueTitles()).toEqual(['Série A', 'Série B', 'Copa de Verão'])

    await choose(wrapper, 'VAutocomplete', 'audit-league', 3)
    await choose(wrapper, 'VAutocomplete', 'audit-championship', 1)

    expect(leagueTitles()).toEqual(['Série A', 'Série B'])
    expect(field(wrapper, 'VAutocomplete', 'audit-league').props('modelValue')).toBeNull()
  })

  it('usuário: busca no servidor com debounce e envia o user_id escolhido', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const wrapper = await mountView()
    const user = field(wrapper, 'VAutocomplete', 'audit-user')

    user.vm.$emit('update:search', 'an')
    user.vm.$emit('update:search', 'ana')
    vi.advanceTimersByTime(299)
    expect(usersService.list).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    await flushPromises()

    expect(usersService.list).toHaveBeenCalledTimes(1)
    expect(usersService.list).toHaveBeenCalledWith({ search: 'ana', page: 1, per_page: 20 })
    expect((user.props('items') as { name: string }[]).map((u) => u.name)).toEqual([
      'Ana Master',
      'Bruno Admin',
    ])

    await choose(wrapper, 'VAutocomplete', 'audit-user', 2)
    user.vm.$emit('update:search', 'Bruno Admin')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(usersService.list).toHaveBeenCalledTimes(1)

    await click(wrapper, 'audit-search')
    expect(lastQuery()).toEqual({ ...BASE, user_id: 2 })
  })

  it('usuário: abrir o menu carrega a 1ª página uma vez', async () => {
    const wrapper = await mountView()
    const user = field(wrapper, 'VAutocomplete', 'audit-user')
    user.vm.$emit('update:menu', true)
    await flushPromises()
    user.vm.$emit('update:menu', true)
    await flushPromises()
    expect(usersService.list).toHaveBeenCalledTimes(1)
    expect(usersService.list).toHaveBeenCalledWith({ search: undefined, page: 1, per_page: 20 })
  })

  it('"Buscar" sem mudar nada recarrega; "Limpar" zera os filtros', async () => {
    const wrapper = await mountView()
    await click(wrapper, 'audit-search')
    expect(calls()).toEqual([BASE, BASE])

    await choose(wrapper, 'VCombobox', 'audit-action', 'draw.reset')
    await click(wrapper, 'audit-search')
    expect(lastQuery()).toEqual({ ...BASE, action: 'draw.reset' })

    await click(wrapper, 'audit-clear')
    expect(lastQuery()).toEqual(BASE)
    expect(field(wrapper, 'VCombobox', 'audit-action').props('modelValue')).toBeNull()
  })

  it('paginação mantém os filtros e troca de itens por página', async () => {
    const wrapper = await mountView()
    await choose(wrapper, 'VSelect', 'audit-type', 'league')
    await click(wrapper, 'audit-search')

    await wrapper
      .find('[data-test="audit-table"] button[aria-label="Próxima página"]')
      .trigger('click')
    await flushPromises()
    expect(lastQuery()).toEqual({ ...BASE, page: 2, auditable_type: 'league' })

    const perPage = wrapper
      .findComponent({ name: 'VDataTableFooter' })
      .findComponent({ name: 'VSelect' })
    expect(perPage.props('items').map((i: { value: number }) => i.value)).toEqual([10, 20, 50, 100])
    perPage.vm.$emit('update:modelValue', 50)
    await flushPromises()
    expect(lastQuery()).toEqual({ page: 1, per_page: 50, auditable_type: 'league' })
  })

  it('clicar na linha ou no olho abre o detalhe do registro', async () => {
    const wrapper = await mountView()
    await wrapper.findAll('[data-test="audit-table"] tbody tr')[1].trigger('click')
    await flushPromises()
    const detail = () =>
      document.querySelector('.v-dialog.v-overlay--active [data-test="audit-detail"]')
    expect(detail()?.textContent).toContain('team.merged')

    await wrapper.findAll('[data-test="audit-view"]')[0].trigger('click')
    await flushPromises()
    expect(detail()?.textContent).toContain('Rodada desfeita')
  })

  it('mostra o erro do servidor (422)', async () => {
    vi.mocked(auditLogsService.listPaginated).mockRejectedValue(
      apiError(422, 'O campo até deve ser uma data posterior ou igual a de.'),
    )
    const wrapper = await mountView()
    expect(wrapper.find('[data-test="audit-error"]').text()).toBe(
      'O campo até deve ser uma data posterior ou igual a de.',
    )
  })

  it('no celular a ação concentra data, usuário, entidade e liga numa coluna', async () => {
    window.innerWidth = 375
    const wrapper = await mountView()
    const headers = wrapper.findAll('[data-test="audit-table"] thead th').map((th) => th.text())
    expect(headers).toEqual(['Ação', ''])
    const [first] = tableRows(wrapper)
    expect(first).toContain('Usuário #9 (excluído)')
    expect(first).toContain('Liga #1 · Série A')
  })
})
