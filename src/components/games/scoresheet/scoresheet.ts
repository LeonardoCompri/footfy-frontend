import { cpfDigits } from '@/components/common/format'
import { groupName } from '@/components/leagues/leagueGroups'
import { GAME_LEG_OPTIONS } from '@/types/game'
import type { Game } from '@/types/game'
import type { EventTypeMeta } from '@/types/gameEvent'
import type { Player } from '@/types/player'
import type { Team } from '@/types/team'

export const ROSTER_ROWS_PER_SHEET = 17
export const EVENT_ROWS = 18

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const CONNECTIVES = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos'])

export function maskCpf(value: string | null | undefined): string {
  const digits = cpfDigits(value)
  if (digits.length !== 11) return ''
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

export function eventTypeAbbreviation(type: Pick<EventTypeMeta, 'name' | 'abbreviation'>): string {
  const abbreviation = type.abbreviation?.trim()
  if (abbreviation) return abbreviation.toUpperCase()
  const words = type.name
    .split(/\s+/)
    .filter((word) => word && !CONNECTIVES.has(word.toLowerCase()))
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export function teamInitials(team: Pick<Team, 'name'> | undefined): string {
  const words = (team?.name ?? '')
    .split(/\s+/)
    .filter((word) => word && !CONNECTIVES.has(word.toLowerCase()))
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export function headCoachName(team: Team | undefined): string | null {
  return team?.technicalCommitteeMembers?.[0]?.name ?? null
}

export function sortRoster(players: Player[] = []): Player[] {
  return [...players].sort((a, b) => {
    if (a.number !== b.number) {
      if (a.number === null) return 1
      if (b.number === null) return -1
      return a.number - b.number
    }
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function rosterSheetsCount(...rosters: Player[][]): number {
  const largest = Math.max(0, ...rosters.map((roster) => roster.length))
  return Math.max(1, Math.ceil(largest / ROSTER_ROWS_PER_SHEET))
}

export function rosterSheet(roster: Player[], sheet: number): (Player | null)[] {
  const start = sheet * ROSTER_ROWS_PER_SHEET
  return Array.from({ length: ROSTER_ROWS_PER_SHEET }, (_, index) => roster[start + index] ?? null)
}

export function gameCode(id: number): string {
  return `#${String(id).padStart(4, '0')}`
}

export function sheetDate(date: string | null, separator = ' · '): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(date ?? '')
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const weekday = WEEKDAYS[new Date(Number(year), Number(month) - 1, Number(day)).getDay()]
  const formatted = `${weekday}, ${day}/${month}/${year}`
  return hour ? `${formatted}${separator}${hour}:${minute}` : formatted
}

export function generatedAt(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function stageDescription(game: Pick<Game, 'round' | 'phase' | 'leg'>): string {
  if (game.round != null) return `${game.round}ª rodada`
  if (!game.phase) return ''
  const leg = GAME_LEG_OPTIONS.find((option) => option.value === game.leg)?.title ?? 'Jogo único'
  return `${game.phase} · ${leg}`
}

export interface ScoresheetTeam {
  name: string
  initials: string
  logo: string | null
  coach: string | null
  roster: Player[]
}

export interface ScoresheetData {
  code: string
  competition: string[]
  home: ScoresheetTeam
  away: ScoresheetTeam
  stageLabel: string
  stage: string
  date: string | null
  matchline: string
  place: string | null
  penalties: boolean
  rosterSheets: number
}

export interface ScoresheetContext {
  championship?: string | null
  league?: string | null
  groupsCount?: number | null
}

function scoresheetTeam(team: Team | undefined, fallback: string): ScoresheetTeam {
  return {
    name: team?.name || fallback,
    initials: teamInitials(team),
    logo: team?.logo ?? null,
    coach: headCoachName(team),
    roster: sortRoster(team?.players),
  }
}

export function buildScoresheet(game: Game, context: ScoresheetContext = {}): ScoresheetData {
  const home = scoresheetTeam(game.homeTeam, 'Mandante')
  const away = scoresheetTeam(game.awayTeam, 'Visitante')
  const championship = game.league?.championship?.name ?? context.championship
  const league = game.league?.name ?? context.league
  const group =
    game.group_number != null && (context.groupsCount ?? 1) > 1
      ? groupName(game.group_number)
      : null
  const stage = [group, stageDescription(game)].filter(Boolean).join(' · ')
  const place = game.stadium?.name
    ? [game.stadium.name, game.stadium.city].filter(Boolean).join(' · ')
    : null
  return {
    code: gameCode(game.id),
    competition: [championship, league].filter((item): item is string => !!item),
    home,
    away,
    stageLabel: game.round != null ? 'Rodada' : 'Fase',
    stage,
    date: sheetDate(game.match_date),
    matchline: [sheetDate(game.match_date, ', '), place].filter(Boolean).join(' · '),
    place,
    penalties: !!game.penalties_possible,
    rosterSheets: rosterSheetsCount(home.roster, away.roster),
  }
}
