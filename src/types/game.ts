import type { GameEvent } from './gameEvent'
import type { LeagueTable } from './leagueStats'
import type { Stadium } from './stadium'
import type { Team } from './team'

export type GameStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled'

export type GameLeg = 1 | 2

export interface Game {
  id: number
  league_id: number
  home_team_id: number
  away_team_id: number
  stadium_id: number | null
  match_date: string | null
  home_score: number | null
  away_score: number | null
  round: number | null
  phase: string | null
  phase_order: number | null
  tie_key: string | null
  leg: GameLeg | null
  status: GameStatus
  created_at: string
  updated_at: string
  homeTeam?: Team
  awayTeam?: Team
  stadium?: Stadium | null
  events?: GameEvent[]
}

export type GamePayload = Pick<
  Game,
  | 'league_id'
  | 'home_team_id'
  | 'away_team_id'
  | 'stadium_id'
  | 'match_date'
  | 'round'
  | 'phase'
  | 'phase_order'
  | 'tie_key'
  | 'leg'
  | 'status'
>

export type GameListParams = {
  league_id: number
  page?: number
  per_page?: number
  round?: number
  phase?: string
  status?: GameStatus
  team_id?: number
}

export const GAME_STATUS_OPTIONS: { value: GameStatus; title: string; color: string }[] = [
  { value: 'scheduled', title: 'Agendada', color: 'info' },
  { value: 'in_progress', title: 'Em andamento', color: 'warning' },
  { value: 'finished', title: 'Finalizada', color: 'success' },
  { value: 'cancelled', title: 'Cancelada', color: 'error' },
]

export const GAME_LEG_OPTIONS: { value: GameLeg | null; title: string }[] = [
  { value: null, title: 'Jogo único' },
  { value: 1, title: 'Ida' },
  { value: 2, title: 'Volta' },
]

export function gameStatusOption(status: GameStatus) {
  return GAME_STATUS_OPTIONS.find((option) => option.value === status) ?? GAME_STATUS_OPTIONS[0]
}

export function gameStageLabel(game: Pick<Game, 'round' | 'phase'> & { leg?: GameLeg | null }): string {
  if (game.round != null) return `${game.round}ª rodada`
  if (!game.phase) return '—'
  const leg = GAME_LEG_OPTIONS.find((option) => option.value === game.leg && option.value !== null)
  return leg ? `${game.phase} · ${leg.title}` : game.phase
}

export interface KnownPhase {
  phase: string
  phase_order: number | null
}

export function knownPhasesOf(table: LeagueTable): KnownPhase[] {
  const unique = new Map<string, KnownPhase>()
  for (const item of table.phases ?? []) {
    if (unique.has(item.phase)) continue
    unique.set(item.phase, { phase: item.phase, phase_order: item.phase_order })
  }
  return [...unique.values()]
}

export function formatMatchDate(date: string | null, withTime = true): string {
  if (!date) return 'Data a definir'
  const [day, time] = date.replace('T', ' ').split(' ')
  const [year, month, dayOfMonth] = day.split('-')
  if (!year || !month || !dayOfMonth) return date
  const formatted = `${dayOfMonth.slice(0, 2)}/${month}/${year}`
  return withTime && time ? `${formatted} ${time.slice(0, 5)}` : formatted
}
