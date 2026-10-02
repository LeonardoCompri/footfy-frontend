import type { GameStatus } from './game'

export interface DashboardTeamSummary {
  id: number
  name: string
  nickname: string | null
  logo: string | null
}

export interface DashboardGame {
  id: number
  home_team: DashboardTeamSummary | null
  away_team: DashboardTeamSummary | null
  home_score: number | null
  away_score: number | null
  status: GameStatus
  match_date: string | null
  round: number | null
  phase: string | null
}

// Gols agrupados por rodada (`type: 'round'`) ou por fase de mata-mata (`type: 'phase'`).
export interface GoalsBucket {
  type: 'round' | 'phase'
  round: number | null
  phase: string | null
  phase_order: number | null
  goals: number
}

export interface ResultsSplit {
  home_wins: number
  draws: number
  away_wins: number
}

// Resposta de GET /leagues/{id}/dashboard (DashboardService no backend).
export interface LeagueDashboard {
  counters: {
    teams: number
    games: number
    stadiums: number
    season: string | null
  }
  last_results: DashboardGame[]
  upcoming_games: DashboardGame[]
  goals_by_bucket: GoalsBucket[]
  results_split: ResultsSplit
}

export interface CardsSplit {
  yellow: number
  red: number
}
