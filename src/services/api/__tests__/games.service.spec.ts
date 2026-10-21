import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { gamesService } from '@/services/api/games.service'
import { makeGame, makePage } from '@/test/factories'

vi.mock('@/services/api/http', () => ({
  default: { get: vi.fn() },
}))

describe('gamesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listPaginated devolve data + meta sem unwrap', async () => {
    const page = makePage([makeGame(1)], { total: 41, last_page: 3 })
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const result = await gamesService.listPaginated({ league_id: 7, page: 2, status: 'finished' })

    expect(http.get).toHaveBeenCalledWith('/games', {
      params: { league_id: 7, page: 2, status: 'finished' },
    })
    expect(result).toEqual(page)
  })

  it('listAll percorre as páginas até last_page com per_page=100 e concatena', async () => {
    vi.mocked(http.get).mockImplementation((_url, config) => {
      const page = (config?.params as { page: number }).page
      return Promise.resolve({
        data: makePage([makeGame(page)], { current_page: page, per_page: 100, last_page: 2 }),
      })
    })

    const result = await gamesService.listAll({ league_id: 7, team_id: 5, status: 'finished' })

    expect(http.get).toHaveBeenCalledTimes(2)
    expect(http.get).toHaveBeenNthCalledWith(1, '/games', {
      params: { league_id: 7, team_id: 5, status: 'finished', page: 1, per_page: 100 },
    })
    expect(http.get).toHaveBeenNthCalledWith(2, '/games', {
      params: { league_id: 7, team_id: 5, status: 'finished', page: 2, per_page: 100 },
    })
    expect(result.map((game) => game.id)).toEqual([1, 2])
  })

  it('listAll faz uma única requisição quando só há uma página', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: makePage([makeGame(1), makeGame(2)]) })

    const result = await gamesService.listAll({ league_id: 7 })

    expect(http.get).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(2)
  })

  it('list continua fazendo unwrap de data', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: [makeGame(1)] } })

    const result = await gamesService.list({ league_id: 7 })

    expect(result.map((game) => game.id)).toEqual([1])
  })
})
