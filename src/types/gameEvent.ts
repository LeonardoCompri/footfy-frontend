export type GameEventType = 'goal' | 'yellow_card' | 'red_card'

export interface GameEvent {
  id: number
  game_id: number
  team_id: number
  player_id: number
  related_player_id: number | null
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

export const GAME_EVENT_TYPE_OPTIONS: { value: GameEventType; title: string }[] = [
  { value: 'goal', title: 'Gol' },
  { value: 'yellow_card', title: 'Cartão Amarelo' },
  { value: 'red_card', title: 'Cartão Vermelho' },
]
