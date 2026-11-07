import type { Game } from './game'
import type { LeagueRules } from './leagueRules'
import type { Stadium } from './stadium'
import type { Team } from './team'

export type LeagueFormat = 'round_robin' | 'knockout' | 'hybrid'

export const LEAGUE_FORMAT_LABELS: Record<LeagueFormat, string> = {
  round_robin: 'Pontos corridos',
  knockout: 'Mata-mata',
  hybrid: 'Grupos + mata-mata',
}

export interface League extends Partial<LeagueRules> {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  organizer: string | null
  season: string | null
  format?: LeagueFormat | null
  championship_id?: number
  championship?: Championship
  teams?: Team[]
  games?: Game[]
  stadiums?: Stadium[]
}

export interface LeaguePayload {
  id?: number
  name: string
  format: LeagueFormat | null
  start_date: string | null
  end_date: string | null
  organizer: string | null
  season: string | null
  championship_id?: number
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
  removeImage?: boolean
  leagues?: LeaguePayload[]
}
