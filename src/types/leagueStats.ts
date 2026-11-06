import type { GameLeg, GameStatus } from './game'
import type { CardsSplit, GoalsBucket, LeagueTotals, ResultsSplit } from './dashboard'

export interface StandingRow {
  team_id: number
  team: { id: number; name: string; nickname: string | null; logo: string | null }
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface KnockoutTieTeam {
  team_id: number
  name: string | null
  nickname: string | null
  aggregate_score: number
}

export interface KnockoutTieLeg {
  id: number
  leg: GameLeg | null
  home_team_id: number
  away_team_id: number
  home_score: number | null
  away_score: number | null
  status: GameStatus
  match_date: string | null
}

export interface KnockoutTie {
  tie_key: string | null
  decided: boolean
  winner_team_id: number | null
  teams: KnockoutTieTeam[]
  legs: KnockoutTieLeg[]
}

export interface KnockoutPhase {
  phase: string
  phase_order: number | null
  ties: KnockoutTie[]
}

export interface LeagueTable {
  standings?: StandingRow[]
  phases?: KnockoutPhase[]
}

export interface RankingPlayer {
  player_id: number
  player_name: string
  player_removed: boolean
  team_id: number | null
  team_name: string | null
  team_nickname: string | null
}

export interface ScorerRow extends RankingPlayer {
  goals: number
}

export interface AssistRow extends RankingPlayer {
  assists: number
}

export interface CardRow extends RankingPlayer {
  yellow_cards: number
  red_cards: number
  total_cards: number
}

export interface LeagueStatistics {
  top_scorers: ScorerRow[]
  top_assists: AssistRow[]
  top_cards: CardRow[]
  goals_by_bucket: GoalsBucket[]
  results_split: ResultsSplit
  cards_split?: CardsSplit
  totals: LeagueTotals
}
