export type GameStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled'

export interface Game {
  id: number
  // TODO(FOOT-0023): o Model/GameResource do backend usa `league_id`, não `championship_id`
  // (mismatch confirmado). Mantido como está para não alterar o payload de criação/edição
  // de partida no admin agora; a correção definitiva depende da rota de backend do FOOT-0023.
  championship_id: number
  home_team_id: number
  away_team_id: number
  stadium_id: number | null
  match_date: string | null
  home_score: number | null
  away_score: number | null
  round: number | null
  status: GameStatus
  created_at: string
  updated_at: string
}

export type GamePayload = Pick<
  Game,
  | 'championship_id'
  | 'home_team_id'
  | 'away_team_id'
  | 'stadium_id'
  | 'match_date'
  | 'home_score'
  | 'away_score'
  | 'round'
  | 'status'
>

export const GAME_STATUS_OPTIONS: { value: GameStatus; title: string }[] = [
  { value: 'scheduled', title: 'Agendada' },
  { value: 'in_progress', title: 'Em andamento' },
  { value: 'finished', title: 'Finalizada' },
  { value: 'cancelled', title: 'Cancelada' },
]
