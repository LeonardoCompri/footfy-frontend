export interface Coach {
  id: number
  team_id: number | null
  name: string
  birth_date: string | null
  created_at: string
  updated_at: string
}

export type CoachPayload = Pick<Coach, 'team_id' | 'name' | 'birth_date'>
