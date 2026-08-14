export interface League {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  organizer: string | null
  season: string | null
  championship_id: number
}

export interface Championship {
  id: number
  name: string
  image: string | null
  leagues?: League[]
}

export interface ChampionshipPayload {
  name: string
  image: File | null
}
