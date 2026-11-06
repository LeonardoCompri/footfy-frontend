import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { leaguesService } from '@/services/api/leagues.service'
import type { LeagueGroups } from '@/types/leagueRules'

vi.mock('@/services/api/http', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

const groups: LeagueGroups = {
  league_id: 7,
  fixture_mode: 'draw',
  groups_count: 2,
  locked: false,
  groups: [],
  unassigned: [],
}

describe('leaguesService — grupos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /leagues/{id}/groups', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: groups } })

    expect(await leaguesService.groups(7)).toEqual(groups)
    expect(http.get).toHaveBeenCalledWith('/leagues/7/groups')
  })

  it('PUT /leagues/{id}/groups com { groups: [{ team_id, group_number }] }', async () => {
    vi.mocked(http.put).mockResolvedValue({ data: { data: groups } })
    const assignments = [{ team_id: 1, group_number: 2 }]

    expect(await leaguesService.saveGroups(7, assignments)).toEqual(groups)
    expect(http.put).toHaveBeenCalledWith('/leagues/7/groups', { groups: assignments })
  })

  it('POST /leagues/{id}/groups/shuffle', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { data: groups } })

    expect(await leaguesService.shuffleGroups(7)).toEqual(groups)
    expect(http.post).toHaveBeenCalledWith('/leagues/7/groups/shuffle')
  })
})
