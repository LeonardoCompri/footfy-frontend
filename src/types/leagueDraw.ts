import type { LeagueFormat } from './championship'
import type { FixtureMode, GroupTeam, Legs } from './leagueRules'

export interface DrawBye {
  round: number
  team: GroupTeam
}

export interface DrawGroup {
  group_number: number
  byes: DrawBye[]
}

export interface ManualRoundGames {
  total: number
  with_results: number
}

export interface LeagueDrawState {
  league_id: number
  format: LeagueFormat | null
  fixture_mode: FixtureMode | null
  groups_count: number | null
  group_legs: Legs | null
  group_size: number | null
  rounds_per_turn: number | null
  total_rounds: number | null
  drawn_rounds: number
  next_round: number | null
  can_draw: boolean
  draw_blocked_reason: string | null
  can_undo: boolean
  undo_blocked_reason: string | null
  can_reset: boolean
  reset_blocked_reason: string | null
  manual_round_games: ManualRoundGames
  groups: DrawGroup[]
}

export interface DrawNextRoundPayload {
  round: number
  replace_manual_rounds?: boolean
}
