import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { leaguesService } from '@/services/api/leagues.service'
import type { LeagueGroups } from '@/types/leagueRules'

vi.mock('@/services/api/http', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
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

describe('leaguesService — sorteio de rodadas', () => {
  const state = { league_id: 7, drawn_rounds: 1 }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /leagues/{id}/draw', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: state } })

    expect(await leaguesService.draw(7)).toEqual(state)
    expect(http.get).toHaveBeenCalledWith('/leagues/7/draw')
  })

  it('POST /leagues/{id}/draw/next-round com round e replace_manual_rounds', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { data: state } })

    expect(
      await leaguesService.drawNextRound(7, { round: 1, replace_manual_rounds: true }),
    ).toEqual(state)
    expect(http.post).toHaveBeenCalledWith('/leagues/7/draw/next-round', {
      round: 1,
      replace_manual_rounds: true,
    })
  })

  it('DELETE /leagues/{id}/draw/last-round com { round } no corpo', async () => {
    vi.mocked(http.delete).mockResolvedValue({ data: { data: state } })

    expect(await leaguesService.undoLastRound(7, 3)).toEqual(state)
    expect(http.delete).toHaveBeenCalledWith('/leagues/7/draw/last-round', { data: { round: 3 } })
  })

  it('DELETE /leagues/{id}/draw sem corpo', async () => {
    vi.mocked(http.delete).mockResolvedValue({ data: { data: state } })

    expect(await leaguesService.resetDraw(7)).toEqual(state)
    expect(http.delete).toHaveBeenCalledWith('/leagues/7/draw')
  })
})

describe('leaguesService — mata-mata', () => {
  const state = { league_id: 7, last_stage: 'QF' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /leagues/{id}/knockout e /knockout/preview', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: state } })

    expect(await leaguesService.knockout(7)).toEqual(state)
    expect(http.get).toHaveBeenCalledWith('/leagues/7/knockout')
    await leaguesService.knockoutPreview(7)
    expect(http.get).toHaveBeenCalledWith('/leagues/7/knockout/preview')
  })

  it('POST /leagues/{id}/knockout/next-stage com stage e replace_manual_phases', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { data: state } })

    expect(
      await leaguesService.knockoutNextStage(7, { stage: 'QF', replace_manual_phases: true }),
    ).toEqual(state)
    expect(http.post).toHaveBeenCalledWith('/leagues/7/knockout/next-stage', {
      stage: 'QF',
      replace_manual_phases: true,
    })
  })

  it('DELETE /leagues/{id}/knockout/last-stage com { stage } no corpo', async () => {
    vi.mocked(http.delete).mockResolvedValue({ data: { data: state } })

    expect(await leaguesService.undoKnockoutStage(7, 'F')).toEqual(state)
    expect(http.delete).toHaveBeenCalledWith('/leagues/7/knockout/last-stage', {
      data: { stage: 'F' },
    })
  })
})
