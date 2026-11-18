import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { auditLogsService } from '@/services/api/auditLogs.service'
import { makeAuditLog, makePage } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: { get: vi.fn() } }))

describe('auditLogsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listPaginated chama GET /audit-logs com os filtros e devolve data + meta', async () => {
    const page = makePage([makeAuditLog(1)], { total: 41, last_page: 3 })
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const params = {
      page: 2,
      per_page: 20,
      from: '2026-11-01',
      to: '2026-11-17',
      action: 'draw.reset',
      auditable_type: 'league' as const,
      auditable_id: 1,
    }
    const result = await auditLogsService.listPaginated(params)

    expect(http.get).toHaveBeenCalledWith('/audit-logs', { params })
    expect(result).toEqual(page)
  })
})
