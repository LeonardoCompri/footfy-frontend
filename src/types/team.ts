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
  // Vem em GET /teams/{id}, no 201 de POST /teams e em POST/DELETE /teams/{id}/leagues.
  leagues?: TeamLeague[]
}

// `logo` é upload de imagem (multipart); `null` mantém o escudo atual na edição.
export interface TeamPayload {
  name: string
  nickname: string | null
  logo: File | null
  // Só usado no create (vínculo na mesma transação); o update nunca envia.
  league_ids?: number[]
}
