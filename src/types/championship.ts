import type { Game } from './game'
import type { Stadium } from './stadium'
import type { Team } from './team'

export type LeagueFormat = 'round_robin' | 'knockout' | 'hybrid'

export const LEAGUE_FORMAT_LABELS: Record<LeagueFormat, string> = {
  round_robin: 'Pontos corridos',
  knockout: 'Mata-mata',
  hybrid: 'Grupos + mata-mata',
}

export interface League {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  organizer: string | null
  season: string | null
  format?: LeagueFormat | null
  // LeagueResource não expõe `championship_id`; o vínculo chega via `championship`,
  // eager loaded em GET /leagues (index) e GET /public/leagues/{id}.
  championship_id?: number
  championship?: Championship
  teams?: Team[]
  games?: Game[]
  stadiums?: Stadium[]
}

// Liga dentro do formulário de campeonato: com `id` é atualizada, sem `id` é criada.
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
  // Ligas ausentes do payload continuam intactas no backend.
  leagues?: LeaguePayload[]
}
