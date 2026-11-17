import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { gameEventsService } from '@/services/api/gameEvents.service'
import { makeEvent, makePage } from '@/test/factories'

vi.mock('@/services/api/http', () => ({
  default: { get: vi.fn() },
}))

describe('gameEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listPaginated envia os filtros e devolve data + meta sem unwrap', async () => {
    const page = makePage([makeEvent(1)], { total: 41, last_page: 3 })
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const result = await gameEventsService.listPaginated({ league_id: 7, team_id: 5, page: 2 })

    expect(http.get).toHaveBeenCalledWith('/game-events', {
      params: { league_id: 7, team_id: 5, page: 2 },
    })
    expect(result).toEqual(page)
  })

  it('listAll lê as páginas pelo meta com per_page=100 e concatena', async () => {
    vi.mocked(http.get).mockImplementation((_url, config) => {
      const page = (config?.params as { page: number }).page
      return Promise.resolve({
        data: makePage([makeEvent(page)], { current_page: page, per_page: 100, last_page: 3 }),
      })
    })

    const result = await gameEventsService.listAll({ league_id: 7, player_id: 10 })

    expect(http.get).toHaveBeenCalledTimes(3)
    for (const page of [1, 2, 3]) {
      expect(http.get).toHaveBeenNthCalledWith(page, '/game-events', {
        params: { league_id: 7, player_id: 10, page, per_page: 100 },
      })
    }
    expect(result.map((event) => event.id)).toEqual([1, 2, 3])
  })

  it('listAll para no teto de 50 páginas', async () => {
    vi.mocked(http.get).mockImplementation((_url, config) => {
      const page = (config?.params as { page: number }).page
      return Promise.resolve({ data: makePage([makeEvent(page)], { last_page: 80 }) })
    })

    const result = await gameEventsService.listAll({ league_id: 7, team_id: 5 })

    expect(http.get).toHaveBeenCalledTimes(50)
    expect(result).toHaveLength(50)
  })

  it('listAll sem meta (back que ignora a paginação) devolve data numa única requisição', async () => {
    const events = [makeEvent(1), makeEvent(2), makeEvent(3)]
    vi.mocked(http.get).mockResolvedValue({ data: { data: events } })

    const result = await gameEventsService.listAll({ league_id: 7, team_id: 5 })

    expect(http.get).toHaveBeenCalledTimes(1)
    expect(result).toEqual(events)
  })
})
