import type { ServerTableParams } from './api'

export interface Player {
  id: number
  team_id: number | null
  name: string
  position: string | null
  number: number | null
  birth_date: string | null
  document: string | null
  created_at: string
  updated_at: string
}

export type PlayerPayload = Pick<
  Player,
  'team_id' | 'name' | 'position' | 'number' | 'birth_date' | 'document'
>

export type PlayerSortField = 'id' | 'name' | 'number' | 'position' | 'birth_date' | 'created_at'

export type PlayerListParams = Partial<ServerTableParams<PlayerSortField>> & {
  team_id?: number
  league_id?: number
}
