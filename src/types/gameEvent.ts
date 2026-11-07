import type { Player } from './player'

export type GameEventType = string

export type EventTypeCountsFor = 'team' | 'opponent'

export type EventTypeCard = 'yellow' | 'red'

export interface EventTypeMeta {
  id: number
  slug: string
  name: string
  abbreviation?: string | null
  icon: string
  color: string
  counts_for: EventTypeCountsFor | null
  allows_assist: boolean
  card: EventTypeCard | null
  sort_order: number
  active: boolean
}

export type EventTypePayload = Omit<EventTypeMeta, 'id'>

export interface GameEventPlayer {
  id: number
  name: string
  removed: boolean
}

export interface GameEvent {
  id: number
  game_id: number
  team_id: number
  player_id: number
  related_player_id: number | null
  player?: GameEventPlayer | null
  related_player?: GameEventPlayer | null
  league_id: number
  type: GameEventType
  minute: number | null
  created_at: string
  updated_at: string
}

export type GameEventPayload = Pick<
  GameEvent,
  'game_id' | 'team_id' | 'player_id' | 'related_player_id' | 'type' | 'minute'
>

export type TeamSide = 'home' | 'away'

export interface SummaryTeam {
  id: number
  name: string
  side: TeamSide
  players: Player[]
}
