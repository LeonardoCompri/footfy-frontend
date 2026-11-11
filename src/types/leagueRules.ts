export type FixtureMode = 'manual' | 'draw'
export type Legs = 1 | 2
export type KnockoutSize = 2 | 4 | 8 | 16

export type Tiebreaker =
  | 'points'
  | 'wins'
  | 'goal_difference'
  | 'goals_for'
  | 'goals_against'
  | 'head_to_head'
  | 'fewer_red_cards'
  | 'fewer_yellow_cards'
  | 'fewer_cards'

export type KnockoutTiebreaker = 'penalties' | 'better_campaign' | 'away_goals'

export interface LeagueRules {
  fixture_mode: FixtureMode
  groups_count: number
  group_legs: Legs
  qualifiers_per_group: number | null
  knockout_size: KnockoutSize | null
  knockout_legs: Legs | null
  final_legs: Legs | null
  third_place: boolean
  tiebreakers: Tiebreaker[] | null
  knockout_tiebreakers: KnockoutTiebreaker[] | null
  max_players_per_team: number
}

export const MAX_GROUPS = 16
export const MIN_PLAYERS_PER_TEAM = 11
export const MAX_PLAYERS_PER_TEAM = 35
export const KNOCKOUT_SIZES: KnockoutSize[] = [16, 8, 4, 2]

export const FIXTURE_MODE_LABELS: Record<FixtureMode, string> = {
  manual: 'Manual',
  draw: 'Sorteio',
}

export const GROUP_LEGS_LABELS: Record<Legs, string> = {
  1: 'Turno único',
  2: 'Turno e returno',
}

export const KNOCKOUT_LEGS_LABELS: Record<Legs, string> = {
  1: 'Jogo único',
  2: 'Ida e volta',
}

export const KNOCKOUT_SIZE_LABELS: Record<KnockoutSize, string> = {
  16: 'Oitavas de final',
  8: 'Quartas de final',
  4: 'Semifinal',
  2: 'Final',
}

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  points: 'Pontos',
  wins: 'Vitórias',
  goal_difference: 'Saldo de gols',
  goals_for: 'Gols marcados',
  goals_against: 'Menos gols sofridos',
  head_to_head: 'Confronto direto',
  fewer_red_cards: 'Menos cartões vermelhos',
  fewer_yellow_cards: 'Menos cartões amarelos',
  fewer_cards: 'Menos cartões',
}

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = [
  'points',
  'wins',
  'goal_difference',
  'goals_for',
  'head_to_head',
  'fewer_cards',
]

export interface KnockoutTiebreakerOption {
  value: string
  title: string
  sequence: KnockoutTiebreaker[]
}

export const KNOCKOUT_TIEBREAKER_OPTIONS: KnockoutTiebreakerOption[] = [
  { value: 'penalties', title: 'Pênaltis', sequence: ['penalties'] },
  { value: 'better_campaign', title: 'Melhor campanha', sequence: ['better_campaign'] },
  {
    value: 'away_goals,penalties',
    title: 'Gol fora → pênaltis',
    sequence: ['away_goals', 'penalties'],
  },
  {
    value: 'away_goals,better_campaign',
    title: 'Gol fora → melhor campanha',
    sequence: ['away_goals', 'better_campaign'],
  },
]

export interface GroupTeam {
  id: number
  name: string
  nickname: string | null
  logo: string | null
}

export interface LeagueGroup {
  group_number: number
  teams: GroupTeam[]
}

export interface LeagueGroups {
  league_id: number
  fixture_mode: FixtureMode
  groups_count: number
  locked: boolean
  groups: LeagueGroup[]
  unassigned: GroupTeam[]
}

export interface GroupAssignment {
  team_id: number
  group_number: number
}
