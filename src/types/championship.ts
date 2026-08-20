import type { Game } from './game'
import type { Stadium } from './stadium'
import type { Team } from './team'

export interface League {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  organizer: string | null
  season: string | null
  championship_id: number
  // Campos abaixo só vêm preenchidos em GET /public/leagues/{id} (eager loaded no backend).
  championship?: Championship
  teams?: Team[]
  games?: Game[]
  stadiums?: Stadium[]
}

export interface LeaguePayload {
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
