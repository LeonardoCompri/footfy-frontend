import type { GameLeg } from './game'
import type { KnockoutSize, KnockoutTiebreaker, Legs } from './leagueRules'

export type KnockoutStageKey = 'R16' | 'QF' | 'SF' | '3P' | 'F'
export type KnockoutStepKey = Exclude<KnockoutStageKey, '3P'>

export interface KnockoutStageMeta {
  label: string
  teams: number
  phase_order: number
  of: string
}

export const KNOCKOUT_STAGES: Record<KnockoutStageKey, KnockoutStageMeta> = {
  R16: { label: 'Oitavas de final', teams: 16, phase_order: 1, of: 'das oitavas de final' },
  QF: { label: 'Quartas de final', teams: 8, phase_order: 2, of: 'das quartas de final' },
  SF: { label: 'Semifinal', teams: 4, phase_order: 3, of: 'das semifinais' },
  '3P': { label: 'Disputa de 3º lugar', teams: 2, phase_order: 4, of: 'da disputa de 3º lugar' },
  F: { label: 'Final', teams: 2, phase_order: 5, of: 'da final' },
}

export const KNOCKOUT_STEP_KEYS: KnockoutStepKey[] = ['R16', 'QF', 'SF', 'F']

export interface KnockoutStageInfo {
  key: KnockoutStageKey
  label: string
  legs: Legs
}

export interface KnockoutStageStatus extends KnockoutStageInfo {
  generated: boolean
}

export interface KnockoutNextStage extends KnockoutStageInfo {
  key: KnockoutStepKey
  with_third_place: boolean
}

export interface KnockoutManualPhaseGames {
  total: number
  with_results: number
}

export interface KnockoutAwaitingPenalties {
  stage: KnockoutStageKey
  tie_key: string
  game_id: number
}

export interface LeagueKnockoutState {
  league_id: number
  enabled: boolean
  knockout_size: KnockoutSize | null
  knockout_legs: Legs | null
  final_legs: Legs | null
  third_place: boolean
  knockout_tiebreakers: KnockoutTiebreaker[] | null
  stages: KnockoutStageStatus[]
  generated_stages: KnockoutStageKey[]
  last_stage: KnockoutStepKey | null
  next_stage: KnockoutNextStage | null
  can_generate: boolean
  generate_blocked_reason: string | null
  can_undo: boolean
  undo_blocked_reason: string | null
  manual_phase_games: KnockoutManualPhaseGames
  awaiting_penalties: KnockoutAwaitingPenalties[]
  cancelled_group_games: number
}

export interface KnockoutPreviewTeam {
  id: number
  name: string
  nickname: string | null
  logo: string | null
}

export interface KnockoutPreviewLeg {
  leg: GameLeg | null
  home_team_id: number
  away_team_id: number
}

export interface KnockoutPreviewTie {
  tie_key: string
  home_team: KnockoutPreviewTeam | null
  away_team: KnockoutPreviewTeam | null
  home_label: string
  away_label: string
  legs: KnockoutPreviewLeg[]
}

export interface KnockoutPreview {
  stage: KnockoutStageInfo
  ties: KnockoutPreviewTie[]
  third_place: KnockoutPreviewTie | null
}

export interface KnockoutNextStagePayload {
  stage: KnockoutStepKey
  replace_manual_phases?: boolean
}
