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

// Totais da liga pelo placar das partidas finalizadas; média null sem partidas (FOOT-0038 no backend).
export interface LeagueTotals {
  goals: number
  finished_games: number
  goals_average: number | null
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
  // Total de cartões amarelos/vermelhos da liga inteira (FOOT-0031 no backend).
  cards_split: CardsSplit
  totals: LeagueTotals
}

export interface CardsSplit {
  yellow: number
  red: number
}
