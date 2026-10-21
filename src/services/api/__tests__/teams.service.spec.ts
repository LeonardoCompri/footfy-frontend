import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { teamsService } from '@/services/api/teams.service'
import { makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({
  default: { post: vi.fn() },
}))

function sentFormData(): FormData {
  return vi.mocked(http.post).mock.calls[0]![1] as FormData
}

describe('teamsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(http.post).mockResolvedValue({ data: { data: makeTeam(7, 'Time A') } })
  })

  it('create envia league_ids[] no multipart junto com os dados do time', async () => {
    await teamsService.create({ name: 'Time A', nickname: null, logo: null, league_ids: [3, 4] })

    expect(http.post).toHaveBeenCalledWith('/teams', expect.any(FormData))
    expect(sentFormData().get('name')).toBe('Time A')
    expect(sentFormData().getAll('league_ids[]')).toEqual(['3', '4'])
  })

  it('update nunca envia league_ids', async () => {
    await teamsService.update(7, { name: 'Time A', nickname: null, logo: null, league_ids: [3] })

    expect(http.post).toHaveBeenCalledWith('/teams/7?_method=PUT', expect.any(FormData))
    expect(sentFormData().get('name')).toBe('Time A')
    expect(sentFormData().has('league_ids[]')).toBe(false)
  })
})
