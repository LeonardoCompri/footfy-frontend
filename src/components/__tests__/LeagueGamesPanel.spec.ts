import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LeagueGamesPanel from '@/components/leagues/LeagueGamesPanel.vue'
import { createTestRouter, createTestVuetify } from '@/test/utils'
import { apiError, makeGame, makePage, makeTeam } from '@/test/factories'
import type { PageParams, Paginated } from '@/types/api'
import type { Game } from '@/types/game'

const serrano = makeTeam(1, 'Atlético Serrano')
const ribeirinho = makeTeam(2, 'Clube Ribeirinho')

function game(id: number, extra: Partial<Game> = {}): Game {
  return makeGame(id, { homeTeam: serrano, awayTeam: ribeirinho, ...extra })
}

async function mountPanel(load: (params: PageParams) => Promise<Paginated<Game>>) {
  const router = createTestRouter()
  await router.push('/ligas/1')
  const wrapper = mount(LeagueGamesPanel, {
    props: { load },
    global: { plugins: [createTestVuetify(), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

function rows(wrapper: Awaited<ReturnType<typeof mountPanel>>['wrapper']) {
  return wrapper
    .find('[data-test=public-games-table]')
    .findAll('tbody tr')
    .map((row) => row.findAll('td').map((cell) => cell.text()))
}

describe('LeagueGamesPanel', () => {
  it('pede a 1ª página com 20 por página e mostra os times de homeTeam/awayTeam na ordem do back', async () => {
    const load = vi.fn().mockResolvedValue(
      makePage([
        game(13, { round: 1, home_score: 0, away_score: 3, status: 'finished' }),
        game(12, { round: null, phase: 'Semifinal', phase_order: 1, leg: 1 }),
        game(10, {
          round: null,
          phase: 'Final',
          phase_order: 2,
          home_score: 2,
          away_score: 2,
          home_penalties: 4,
          away_penalties: 3,
          status: 'finished',
        }),
      ]),
    )

    const { wrapper } = await mountPanel(load)

    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith({ page: 1, per_page: 20 })
    expect(rows(wrapper).map((cells) => cells.slice(0, 4))).toEqual([
      ['1ª rodada', 'Atlético Serrano', '0 × 3', 'Clube Ribeirinho'],
      ['Semifinal · Ida', 'Atlético Serrano', '— × —', 'Clube Ribeirinho'],
      ['Final', 'Atlético Serrano', '2 (4) × (3) 2', 'Clube Ribeirinho'],
    ])
    expect(wrapper.find('[data-test=public-games-pagination]').exists()).toBe(false)
  })

  it('trocar de página pede page=2 e substitui as linhas', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(makePage([game(1)], { total: 25, last_page: 2 }))
      .mockResolvedValueOnce(
        makePage([game(2, { round: 3 })], { current_page: 2, total: 25, last_page: 2 }),
      )
    const { wrapper } = await mountPanel(load)

    await wrapper
      .find('[data-test=public-games-pagination] button[aria-label="Próxima página"]')
      .trigger('click')
    await flushPromises()

    expect(load).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenLastCalledWith({ page: 2, per_page: 20 })
    expect(rows(wrapper).map(([stage]) => stage)).toEqual(['3ª rodada'])
  })

  it('ignora a resposta de uma página que chegou depois da página seguinte', async () => {
    let resolveSecond!: (page: Paginated<Game>) => void
    const load = vi
      .fn()
      .mockResolvedValueOnce(makePage([game(1)], { total: 45, last_page: 3 }))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)))
      .mockResolvedValueOnce(
        makePage([game(3, { round: 7 })], { current_page: 3, total: 45, last_page: 3 }),
      )
    const { wrapper } = await mountPanel(load)
    const next = () =>
      wrapper
        .find('[data-test=public-games-pagination] button[aria-label="Próxima página"]')
        .trigger('click')

    await next()
    await next()
    await flushPromises()
    resolveSecond(makePage([game(2, { round: 5 })], { current_page: 2, total: 45, last_page: 3 }))
    await flushPromises()

    expect(load).toHaveBeenLastCalledWith({ page: 3, per_page: 20 })
    expect(rows(wrapper).map(([stage]) => stage)).toEqual(['7ª rodada'])
  })

  it('mostra o aviso de lista vazia quando a liga não tem partidas', async () => {
    const { wrapper } = await mountPanel(vi.fn().mockResolvedValue(makePage([])))

    expect(wrapper.text()).toContain('Nenhuma partida cadastrada para esta liga ainda.')
    expect(wrapper.find('[data-test=public-games-table]').exists()).toBe(false)
  })

  it('mostra a mensagem do back quando a liga não existe', async () => {
    const { wrapper } = await mountPanel(
      vi.fn().mockRejectedValue(apiError(422, 'Liga não encontrada!')),
    )

    expect(wrapper.text()).toContain('Liga não encontrada!')
    expect(wrapper.find('[data-test=public-games-table]').exists()).toBe(false)
  })

  it('clicar na linha abre o detalhe da partida', async () => {
    const { wrapper, router } = await mountPanel(vi.fn().mockResolvedValue(makePage([game(42)])))

    await wrapper.find('[data-test=public-games-table] tbody tr').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/partidas/42')
  })
})
