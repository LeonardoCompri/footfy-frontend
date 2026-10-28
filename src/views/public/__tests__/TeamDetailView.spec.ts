import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createWebHistory, type Router } from 'vue-router'
import TeamDetailView from '@/views/public/teams/TeamDetailView.vue'
import StatTiles from '@/components/common/StatTiles.vue'
import { publicTeamsService } from '@/services/api/publicTeams.service'
import { createTestRouter, createTestVuetify } from '@/test/utils'
import { makeMember, makePlayer, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/publicTeams.service', () => ({
  publicTeamsService: { get: vi.fn() },
}))

const team = makeTeam(5, 'Vitória FC', {
  players: [makePlayer(10, 'Goleiro Um', { team_id: 5, position: 'GOL', number: 1 })],
  technicalCommitteeMembers: [
    makeMember(20, 'Técnico Fulano', { team_id: 5, role: 'Treinador', birth_date: '1980-05-10' }),
    makeMember(21, 'Auxiliar Beltrano', { team_id: 5, role: 'Auxiliar Técnico' }),
  ],
})

async function mountDetail(path: string, router: Router = createTestRouter()) {
  await router.push(path)
  const wrapper = mount(TeamDetailView, {
    props: { id: '5' },
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

function backButton(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  return wrapper.findAll('button').find((button) => button.text() === 'Voltar')!
}

describe('TeamDetailView público', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicTeamsService.get).mockResolvedValue(team)
  })

  it('Voltar com ?back= leva para o detalhe da liga de origem', async () => {
    const { wrapper, router } = await mountDetail('/times/5?back=7')

    await backButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('leagues-detail')
    expect(router.currentRoute.value.params.id).toBe('7')
  })

  it('Voltar sem ?back= e sem histórico leva para a lista de campeonatos', async () => {
    const { wrapper, router } = await mountDetail('/times/5')

    await backButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('championships-list')
  })

  it('Voltar sem ?back= e com histórico volta para a página anterior', async () => {
    const router = createTestRouter(createWebHistory())
    await router.push('/campeonatos/3')
    const { wrapper } = await mountDetail('/times/5', router)

    await backButton(wrapper).trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/campeonatos/3'))
  })

  it('exibe a comissão técnica que vem de GET /public/teams/{id}', async () => {
    const { wrapper } = await mountDetail('/times/5?tab=comissao')

    expect(publicTeamsService.get).toHaveBeenCalledWith('5')
    expect(wrapper.findComponent(StatTiles).props('items')).toEqual([
      { label: 'Elenco', value: 1 },
      { label: 'Comissão Técnica', value: 2 },
    ])
    const rows = wrapper
      .findAll('tbody tr')
      .map((row) => row.findAll('td').map((cell) => cell.text()))
    expect(rows).toEqual([
      ['Técnico Fulano', 'Treinador', '10/05/1980'],
      ['Auxiliar Beltrano', 'Auxiliar Técnico', '—'],
    ])
    expect(wrapper.text()).not.toContain('Nenhum membro da comissão técnica')
  })

  it('mostra o aviso de vazio quando o time não tem comissão técnica', async () => {
    vi.mocked(publicTeamsService.get).mockResolvedValue({ ...team, technicalCommitteeMembers: [] })

    const { wrapper } = await mountDetail('/times/5?tab=comissao')

    expect(wrapper.findComponent(StatTiles).props('items')[1]).toEqual({
      label: 'Comissão Técnica',
      value: 0,
    })
    expect(wrapper.text()).toContain('Nenhum membro da comissão técnica cadastrado')
  })
})
