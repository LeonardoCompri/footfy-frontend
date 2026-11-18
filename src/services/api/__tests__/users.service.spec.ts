import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { usersService } from '@/services/api/users.service'
import { makeAppUser, makePage } from '@/test/factories'

vi.mock('@/services/api/http', () => ({
  default: { get: vi.fn() },
}))

describe('usersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listPaginated manda página, busca e ordenação e devolve data + meta', async () => {
    const page = makePage([makeAppUser(1, 'Ana', 'admin')], { total: 21, last_page: 2 })
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const params = {
      page: 2,
      per_page: 20,
      search: '123.456',
      sort: 'email' as const,
      order: 'asc' as const,
    }
    const result = await usersService.listPaginated(params)

    expect(http.get).toHaveBeenCalledWith('/users', { params })
    expect(result).toEqual(page)
  })

  it('list continua fazendo unwrap de data', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: [makeAppUser(1, 'Ana', 'admin')] } })

    const result = await usersService.list()

    expect(result.map((user) => user.name)).toEqual(['Ana'])
  })
})
