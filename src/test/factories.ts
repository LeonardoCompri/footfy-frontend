import type { Paginated, PaginationMeta } from '@/types/api'
import type { Game } from '@/types/game'
import type { EventTypeMeta, GameEvent } from '@/types/gameEvent'
import type { LeagueKnockoutState } from '@/types/leagueKnockout'
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

export function makeEventType(
  id: number,
  slug: string,
  extra: Partial<EventTypeMeta> = {},
): EventTypeMeta {
  return {
    id,
    slug,
    name: slug,
    icon: 'mdi-soccer',
    color: 'primary',
    counts_for: null,
    allows_assist: false,
    card: null,
    sort_order: id,
    active: true,
    ...extra,
  }
}

export function defaultEventTypes(): EventTypeMeta[] {
  return [
    makeEventType(1, 'goal', { name: 'Gol', counts_for: 'team', allows_assist: true }),
    makeEventType(2, 'own_goal', { name: 'Gol contra', color: 'error', counts_for: 'opponent' }),
    makeEventType(3, 'yellow_card', {
      name: 'Cartão amarelo',
      icon: 'mdi-card',
      color: 'card-yellow',
      card: 'yellow',
    }),
    makeEventType(4, 'red_card', {
      name: 'Cartão vermelho',
      icon: 'mdi-card',
      color: 'card-red',
      card: 'red',
    }),
  ]
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

export function makePage<T>(data: T[], meta: Partial<PaginationMeta> = {}): Paginated<T> {
  return {
    data,
    meta: { current_page: 1, per_page: 20, total: data.length, last_page: 1, ...meta },
  }
}

export function makeKnockoutState(extra: Partial<LeagueKnockoutState> = {}): LeagueKnockoutState {
  return {
    league_id: 7,
    enabled: true,
    knockout_size: 8,
    knockout_legs: 2,
    final_legs: 1,
    third_place: true,
    knockout_tiebreakers: ['away_goals', 'penalties'],
    stages: [
      { key: 'QF', label: 'Quartas de final', legs: 2, generated: false },
      { key: 'SF', label: 'Semifinal', legs: 2, generated: false },
      { key: '3P', label: 'Disputa de 3º lugar', legs: 1, generated: false },
      { key: 'F', label: 'Final', legs: 1, generated: false },
    ],
    generated_stages: [],
    last_stage: null,
    next_stage: { key: 'QF', label: 'Quartas de final', legs: 2, with_third_place: false },
    can_generate: true,
    generate_blocked_reason: null,
    can_undo: false,
    undo_blocked_reason: 'Nenhuma fase do mata-mata foi gerada.',
    manual_phase_games: { total: 0, with_results: 0 },
    awaiting_penalties: [],
    ...extra,
  }
}
