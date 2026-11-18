import http from './http'
import { createResourceService } from './resource'
import type { Paginated } from '@/types/api'
import type { AuditLog, AuditLogListParams } from '@/types/auditLog'

const baseUrl = '/audit-logs'

function listPaginated(params: AuditLogListParams): Promise<Paginated<AuditLog>> {
  return http.get<Paginated<AuditLog>>(baseUrl, { params }).then((res) => res.data)
}

export const auditLogsService = {
  ...createResourceService<AuditLog, never>(baseUrl),
  listPaginated,
}
