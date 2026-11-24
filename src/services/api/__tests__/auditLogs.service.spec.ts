import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { auditLogsService } from '@/services/api/auditLogs.service'
import { extractErrorMessage } from '@/composables/useCrud'
import { makeAuditLog, makePage } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: { get: vi.fn() } }))

describe('auditLogsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  describe('exportCsv', () => {
    const filters = { from: '2026-11-01', action: 'draw.reset', league_id: 2 }
    const csv = new Blob(['\uFEFFdata;acao\n'], { type: 'text/csv' })

    function blobError(status: number, body: string) {
      return { response: { status, data: new Blob([body], { type: 'application/json' }) } }
    }

    it('chama GET /audit-logs/export só com os filtros, como blob, e devolve o arquivo', async () => {
      vi.mocked(http.get).mockResolvedValue({
        data: csv,
        headers: { 'content-disposition': 'attachment; filename=auditoria-2026-11-24.csv' },
      })

      const result = await auditLogsService.exportCsv(filters)

      expect(http.get).toHaveBeenCalledWith('/audit-logs/export', {
        params: filters,
        responseType: 'blob',
      })
      expect(result).toEqual({ blob: csv, filename: 'auditoria-2026-11-24.csv' })
    })

    it.each([
      ['attachment; filename="auditoria-2026-11-20.csv"', 'auditoria-2026-11-20.csv'],
      ['attachment; filename = auditoria-2026-11-20.csv ; size=10', 'auditoria-2026-11-20.csv'],
      [
        "attachment; filename=auditoria.csv; filename*=UTF-8''auditoria%202026-11-20.csv",
        'auditoria 2026-11-20.csv',
      ],
      ["attachment; filename*=UTF-8''%E0%A4%A; filename=auditoria-x.csv", 'auditoria-x.csv'],
    ])('lê o nome de "%s"', async (disposition, filename) => {
      vi.mocked(http.get).mockResolvedValue({
        data: csv,
        headers: { 'content-disposition': disposition },
      })
      expect((await auditLogsService.exportCsv({})).filename).toBe(filename)
    })

    it.each([[{}], [{ 'content-disposition': 'attachment' }]])(
      'sem nome no cabeçalho usa auditoria-AAAA-MM-DD.csv com a data local',
      async (headers) => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 0, 5, 23, 30))
        vi.mocked(http.get).mockResolvedValue({ data: csv, headers })
        expect((await auditLogsService.exportCsv({})).filename).toBe('auditoria-2026-01-05.csv')
      },
    )

    it('erro com corpo Blob (422) vira JSON para o tratamento padrão', async () => {
      const message =
        'A busca tem 60000 registros; o limite da exportação é 50000. Refine os filtros.'
      vi.mocked(http.get).mockRejectedValue(blobError(422, JSON.stringify({ message })))

      const err = await auditLogsService.exportCsv(filters).catch((e: unknown) => e)

      expect(err).toMatchObject({ response: { status: 422, data: { message } } })
      expect(extractErrorMessage(err)).toBe(message)
    })

    it('corpo de erro que não é JSON cai na mensagem genérica', async () => {
      vi.mocked(http.get).mockRejectedValue(blobError(502, '<html>Bad Gateway</html>'))
      const err = await auditLogsService.exportCsv({}).catch((e: unknown) => e)
      expect(extractErrorMessage(err)).toBe('Ocorreu um erro inesperado.')
    })

    it('erro sem resposta segue sem mudança', async () => {
      const network = new Error('Network Error')
      vi.mocked(http.get).mockRejectedValue(network)
      await expect(auditLogsService.exportCsv({})).rejects.toBe(network)
    })
  })
})
