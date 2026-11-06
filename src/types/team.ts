import type { Player } from './player'
import type { TechnicalCommitteeMember } from './technicalCommitteeMember'

export interface TeamLeague {
  id: number
  name: string
}

export interface Team {
  id: number
  name: string
  nickname: string | null
  logo: string | null
  created_at: string
  updated_at: string
  players?: Player[]
  technicalCommitteeMembers?: TechnicalCommitteeMember[]
  leagues?: TeamLeague[]
}

export interface TeamPayload {
  name: string
  nickname: string | null
  logo: File | null
  league_ids?: number[]
}
