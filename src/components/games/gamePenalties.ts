import type { Game, GamePenaltiesPayload } from '@/types/game'
import { isGeneratedKnockout } from '@/types/game'

export const PENALTIES_BOTH = 'Informe os pênaltis dos dois times.'
export const PENALTIES_RANGE = 'Informe um número inteiro de 0 a 99.'
export const PENALTIES_TIED = 'A disputa de pênaltis não pode terminar empatada.'

export function showsPenalties(game: Game | null | undefined): boolean {
  if (!game || !isGeneratedKnockout(game)) return false
  return !!game.penalties_allowed || game.home_penalties != null || game.away_penalties != null
}

function normalize(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function penaltiesError(home: unknown, away: unknown): string | null {
  const values = [normalize(home), normalize(away)]
  if (values.some((value) => value === '')) return PENALTIES_BOTH
  if (!values.every((value) => /^\d{1,2}$/.test(value))) return PENALTIES_RANGE
  if (Number(values[0]) === Number(values[1])) return PENALTIES_TIED
  return null
}

export function penaltiesPayload(home: unknown, away: unknown): GamePenaltiesPayload {
  return { home_penalties: Number(normalize(home)), away_penalties: Number(normalize(away)) }
}
