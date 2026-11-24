import http from './http'
import { createResourceService } from './resource'
import { filenameFromContentDisposition, parseBlobError, type FileDownload } from './download'
import type { Paginated } from '@/types/api'
import type { AuditLog, AuditLogFilters, AuditLogListParams } from '@/types/auditLog'

const baseUrl = '/audit-logs'

function listPaginated(params: AuditLogListParams): Promise<Paginated<AuditLog>> {
  return http.get<Paginated<AuditLog>>(baseUrl, { params }).then((res) => res.data)
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

async function exportCsv(filters: AuditLogFilters): Promise<FileDownload> {
  try {
    const res = await http.get<Blob>(`${baseUrl}/export`, {
      params: filters,
      responseType: 'blob',
    })
    const filename =
      filenameFromContentDisposition(res.headers['content-disposition']) ??
      `auditoria-${todayIso()}.csv`
    return { blob: res.data, filename }
  } catch (err) {
    throw await parseBlobError(err)
  }
}

export const auditLogsService = {
  ...createResourceService<AuditLog, never>(baseUrl),
  listPaginated,
  exportCsv,
}
