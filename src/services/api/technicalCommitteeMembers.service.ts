import http from './http'
import { createResourceService, unwrap } from './resource'
import type { SelectOption } from '@/types/api'
import type {
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload,
} from '@/types/technicalCommitteeMember'

let rolesCache: Promise<SelectOption[]> | null = null

const baseUrl = '/technical-committee-members'

export const technicalCommitteeMembersService = {
  ...createResourceService<TechnicalCommitteeMember, TechnicalCommitteeMemberPayload>(baseUrl),
  roles: () =>
    (rolesCache ??= unwrap<SelectOption[]>(http.get(`${baseUrl}/roles`)).catch((err) => {
      rolesCache = null
      throw err
    })),
}
