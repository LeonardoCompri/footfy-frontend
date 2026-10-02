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
  // Só vêm preenchidos em GET /teams/{id} e GET /public/teams/{id} (eager loaded no backend).
  players?: Player[]
  technicalCommitteeMembers?: TechnicalCommitteeMember[]
  // Só vem preenchido nas respostas de POST/DELETE /teams/{id}/leagues.
  leagues?: TeamLeague[]
}

// `logo` é upload de imagem (multipart); `null` mantém o escudo atual na edição.
export interface TeamPayload {
  name: string
  nickname: string | null
  logo: File | null
}
