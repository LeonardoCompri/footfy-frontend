import type { GameEvent } from './gameEvent'
import type { Stadium } from './stadium'
import type { Team } from './team'

export type GameStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled'

// Perna do confronto de mata-mata: 1 = ida, 2 = volta; `null` = jogo único.
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
  // Pontos corridos usam `round`; mata-mata usa `phase` (+ `phase_order`, `tie_key`, `leg`).
  round: number | null
  phase: string | null
  phase_order: number | null
  tie_key: string | null
  leg: GameLeg | null
  status: GameStatus
  created_at: string
  updated_at: string
  // Times e estádio vêm eager loaded em GET /games (index) e GET /games/{id}; `events` só no show.
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
  | 'home_score'
  | 'away_score'
  | 'round'
  | 'phase'
  | 'phase_order'
  | 'tie_key'
  | 'leg'
  | 'status'
>

// Filtros de GET /games (`league_id` obrigatório). `type` (não interface) para caber em `ListParams`.
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

// Etapa da partida: "3ª rodada" ou "Semifinal · Ida".
export function gameStageLabel(game: Pick<Game, 'round' | 'phase'> & { leg?: GameLeg | null }): string {
  if (game.round != null) return `${game.round}ª rodada`
  if (!game.phase) return '—'
  const leg = GAME_LEG_OPTIONS.find((option) => option.value === game.leg && option.value !== null)
  return leg ? `${game.phase} · ${leg.title}` : game.phase
}

// `match_date` chega como "YYYY-MM-DD HH:mm:ss" (sem fuso): exibe sem conversão de fuso.
export function formatMatchDate(date: string | null, withTime = true): string {
  if (!date) return 'Data a definir'
  const [day, time] = date.replace('T', ' ').split(' ')
  const [year, month, dayOfMonth] = day.split('-')
  if (!year || !month || !dayOfMonth) return date
  const formatted = `${dayOfMonth.slice(0, 2)}/${month}/${year}`
  return withTime && time ? `${formatted} ${time.slice(0, 5)}` : formatted
}
