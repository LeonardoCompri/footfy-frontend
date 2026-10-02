export interface Stadium {
  id: number
  league_id: number
  name: string
  city: string
  capacity: number
  created_at: string
  updated_at: string
}

export type StadiumPayload = Pick<Stadium, 'league_id' | 'name' | 'city' | 'capacity'>
