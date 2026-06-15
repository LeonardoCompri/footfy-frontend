export interface Championship {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  organizer: string | null
  created_at: string
  updated_at: string
}

export type ChampionshipPayload = Pick<Championship, 'name' | 'start_date' | 'end_date' | 'organizer'>
