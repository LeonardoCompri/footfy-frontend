import type { Game, GamePenaltyKick } from '@/types/game'
import { hasPenalties } from '@/types/game'

export const REGULATION_KICKS = 5
export const MAX_KICKS = 60

export interface ShootoutKick {
  team_id: number
  scored: boolean
}

export interface ShootoutResult {
  finished: boolean
  home: number
  away: number
  winner: number | null
  decided_at: number | null
}

export interface ShootoutTeam {
  id: number
  name: string
}

export interface ShootoutGridKick {
  team_id: number
  number: number | null
  name?: string | null
  scored: boolean | null
}

export interface ShootoutDraftKick {
  team_id: number
  player_id: number | null
  scored: boolean | null
}

export const SHOOTOUT_EMPTY = 'Escolha quem bateu primeiro e registre as cobranças.'
export const SHOOTOUT_UNFINISHED =
  'A disputa de pênaltis ainda não está decidida; registre as cobranças até o fim.'
export const SHOOTOUT_MAX = `A disputa de pênaltis pode ter no máximo ${MAX_KICKS} cobranças.`

export function shootoutDecidedAt(order: number): string {
  return `A disputa de pênaltis foi decidida na cobrança ${order}; remova as cobranças seguintes.`
}

export function shootoutIncomplete(order: number): string {
  return `Informe o cobrador e o resultado da cobrança ${order}.`
}

function isDecided(home: number, away: number, homeTaken: number, awayTaken: number): boolean {
  if (homeTaken <= REGULATION_KICKS && awayTaken <= REGULATION_KICKS) {
    return home + REGULATION_KICKS - homeTaken < away || away + REGULATION_KICKS - awayTaken < home
  }
  return homeTaken === awayTaken && home !== away
}

export function resolveShootout(
  kicks: readonly ShootoutKick[],
  homeTeamId: number,
  awayTeamId: number,
): ShootoutResult {
  const score = { home: 0, away: 0 }
  const taken = { home: 0, away: 0 }
  let decidedAt: number | null = null
  let winner: number | null = null

  kicks.forEach((kick, index) => {
    const side = kick.team_id === homeTeamId ? 'home' : kick.team_id === awayTeamId ? 'away' : null
    if (!side) return
    taken[side]++
    if (kick.scored) score[side]++
    if (decidedAt === null && isDecided(score.home, score.away, taken.home, taken.away)) {
      decidedAt = index + 1
      winner = score.home > score.away ? homeTeamId : awayTeamId
    }
  })

  return {
    finished: decidedAt !== null,
    home: score.home,
    away: score.away,
    winner,
    decided_at: decidedAt,
  }
}

export function outOfTurn(kicks: readonly { team_id: number }[]): number | null {
  for (let index = 1; index < kicks.length; index++) {
    if (kicks[index].team_id === kicks[index - 1].team_id) return index + 1
  }
  return null
}

export function kickTeamId(
  index: number,
  firstTeamId: number,
  homeTeamId: number,
  awayTeamId: number,
): number {
  if (index % 2 === 0) return firstTeamId
  return firstTeamId === homeTeamId ? awayTeamId : homeTeamId
}

export function draftResult(
  rows: readonly Pick<ShootoutDraftKick, 'team_id' | 'scored'>[],
  homeTeamId: number,
  awayTeamId: number,
): ShootoutResult {
  const pending = rows.findIndex((row) => row.scored === null)
  const filled = (pending === -1 ? rows : rows.slice(0, pending)).map((row) => ({
    team_id: row.team_id,
    scored: row.scored === true,
  }))
  return resolveShootout(filled, homeTeamId, awayTeamId)
}

export function shootoutDraftIssue(
  rows: readonly ShootoutDraftKick[],
  homeTeamId: number,
  awayTeamId: number,
): string | null {
  if (rows.length === 0) return SHOOTOUT_EMPTY
  if (rows.length > MAX_KICKS) return SHOOTOUT_MAX
  const result = draftResult(rows, homeTeamId, awayTeamId)
  if (result.decided_at !== null && result.decided_at < rows.length) {
    return shootoutDecidedAt(result.decided_at)
  }
  const incomplete = rows.findIndex((row) => row.player_id === null || row.scored === null)
  if (incomplete !== -1) return shootoutIncomplete(incomplete + 1)
  return result.finished ? null : SHOOTOUT_UNFINISHED
}

export function canAddKick(
  rows: readonly ShootoutDraftKick[],
  homeTeamId: number,
  awayTeamId: number,
): boolean {
  if (rows.length >= MAX_KICKS) return false
  const last = rows[rows.length - 1]
  if (last && (last.player_id === null || last.scored === null)) return false
  return !draftResult(rows, homeTeamId, awayTeamId).finished
}

export function repeatedKickers(
  rows: readonly Pick<ShootoutDraftKick, 'team_id' | 'player_id'>[],
  rosterSize: (teamId: number) => number,
): Map<number, number> {
  const repeated = new Map<number, number>()
  const cycles = new Map<number, Map<number, number>>()
  rows.forEach((row, index) => {
    if (row.player_id === null) return
    const seen = cycles.get(row.team_id) ?? new Map<number, number>()
    cycles.set(row.team_id, seen)
    if (seen.size >= rosterSize(row.team_id)) seen.clear()
    const previous = seen.get(row.player_id)
    if (previous !== undefined) repeated.set(index, previous)
    seen.set(row.player_id, index + 1)
  })
  return repeated
}

export function shootoutColumns(
  kicks: readonly { team_id: number }[],
  homeTeamId: number,
  awayTeamId: number,
): number {
  const home = kicks.filter((kick) => kick.team_id === homeTeamId).length
  const away = kicks.filter((kick) => kick.team_id === awayTeamId).length
  return Math.max(REGULATION_KICKS, home, away)
}

export function savedKicks(game: Pick<Game, 'penaltyKicks'>): GamePenaltyKick[] {
  return game.penaltyKicks ?? []
}

export function hasShootout(game: Game | null | undefined): boolean {
  if (!game) return false
  return savedKicks(game).length > 0 || hasPenalties(game)
}

export function showsShootoutEditor(game: Game | null | undefined): boolean {
  if (!game) return false
  return !!game.penalties_allowed || savedKicks(game).length > 0
}

export function shootoutTeams(game: Game): { home: ShootoutTeam; away: ShootoutTeam } {
  return {
    home: {
      id: game.home_team_id,
      name: game.homeTeam?.nickname || game.homeTeam?.name || 'Mandante',
    },
    away: {
      id: game.away_team_id,
      name: game.awayTeam?.nickname || game.awayTeam?.name || 'Visitante',
    },
  }
}

export function gridKicks(kicks: readonly GamePenaltyKick[]): ShootoutGridKick[] {
  return kicks.map((kick) => ({
    team_id: kick.team_id,
    number: kick.player?.number ?? null,
    name: kick.player?.name ?? null,
    scored: kick.scored,
  }))
}
