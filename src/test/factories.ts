import type { Game } from '@/types/game'
import type { GameEvent } from '@/types/gameEvent'
import type { Player } from '@/types/player'
import type { Team } from '@/types/team'
import type { TechnicalCommitteeMember } from '@/types/technicalCommitteeMember'
import type { User } from '@/types/user'

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

export function makeGame(id: number, extra: Partial<Game> = {}): Game {
  return {
    id,
    league_id: 1,
    home_team_id: 1,
    away_team_id: 2,
    stadium_id: null,
    match_date: null,
    home_score: null,
    away_score: null,
    round: 1,
    phase: null,
    phase_order: null,
    tie_key: null,
    leg: null,
    status: 'scheduled',
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

export function makeEvent(id: number, extra: Partial<GameEvent> = {}): GameEvent {
  return {
    id,
    game_id: 1,
    team_id: 1,
    player_id: 1,
    related_player_id: null,
    league_id: 1,
    type: 'goal',
    minute: null,
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

export function makeAppUser(id: number, name: string, role: string, extra: Partial<User> = {}): User {
  return {
    id,
    name,
    email: null,
    document: String(id).padStart(11, '0'),
    roles: [role],
    leagues: [],
    created_at: '',
    updated_at: '',
    ...extra,
  }
}
