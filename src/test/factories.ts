import type { Player } from '@/types/player'
import type { Team } from '@/types/team'
import type { TechnicalCommitteeMember } from '@/types/technicalCommitteeMember'

export function makeTeam(id: number, name: string, extra: Partial<Team> = {}): Team {
  return { id, name, nickname: null, logo: null, created_at: '', updated_at: '', ...extra }
}

export function makePlayer(id: number, name: string, extra: Partial<Player> = {}): Player {
  return {
    id,
    team_id: 1,
    name,
    position: null,
    number: null,
    birth_date: null,
    document: null,
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

export function makeMember(
  id: number,
  name: string,
  extra: Partial<TechnicalCommitteeMember> = {},
): TechnicalCommitteeMember {
  return { id, team_id: 1, name, role: 'Treinador', birth_date: null, created_at: '', updated_at: '', ...extra }
}

// Formato de erro do Axios que o useCrud lê (`response.status` + `response.data`).
export function apiError(status: number, message: string, errors?: Record<string, string[]>) {
  return { response: { status, data: { message, errors } } }
}

export const POSITIONS = [
  { value: 'GOL', title: 'Goleiro' },
  { value: 'ATA', title: 'Atacante' },
]

export const ROLES = [
  { value: 'Treinador', title: 'Treinador' },
  { value: 'Preparador Físico', title: 'Preparador Físico' },
]
