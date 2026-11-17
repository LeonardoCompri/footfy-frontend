import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { publicChampionshipsService } from '@/services/api/publicChampionships.service'
import { publicLeaguesService } from '@/services/api/publicLeagues.service'
import { makeGame, makePage } from '@/test/factories'

vi.mock('@/services/api/http', () => ({
  default: { get: vi.fn() },
}))

describe('services públicos paginados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publicChampionshipsService.listPaginated manda page, per_page e search e devolve data + meta', async () => {
    const page = makePage([{ id: 1, name: 'Copa Footfy', image: null }], { last_page: 3 })
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const result = await publicChampionshipsService.listPaginated({
      page: 2,
      per_page: 12,
      search: 'copa',
    })

    expect(http.get).toHaveBeenCalledWith('/public/championships', {
      params: { page: 2, per_page: 12, search: 'copa' },
    })
    expect(result).toEqual(page)
  })

  it('publicLeaguesService.games pede GET /public/leagues/{id}/games e devolve data + meta', async () => {
    const page = makePage([makeGame(1)], { total: 41, last_page: 3 })
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const result = await publicLeaguesService.games('7', { page: 2, per_page: 20 })

    expect(http.get).toHaveBeenCalledWith('/public/leagues/7/games', {
      params: { page: 2, per_page: 20 },
    })
    expect(result).toEqual(page)
  })
})
