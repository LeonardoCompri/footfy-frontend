import { createResourceService } from './resource'
import type {
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload,
} from '@/types/technicalCommitteeMember'

export const technicalCommitteeMembersService = createResourceService<
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload
>('/technical-committee-members')
