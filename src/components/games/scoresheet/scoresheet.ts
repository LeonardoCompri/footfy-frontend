import { cpfDigits } from '@/components/common/format'
import { hasShootout, savedKicks, shootoutColumns } from '@/components/games/shootout'
import { groupName } from '@/components/leagues/leagueGroups'
import { GAME_LEG_OPTIONS, hasPenalties } from '@/types/game'
import type { Game, GamePenaltyKick } from '@/types/game'
import type { EventTypeMeta, GameEvent, TeamSide } from '@/types/gameEvent'
import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '@/types/leagueRules'
import type { Player } from '@/types/player'
import type { Team } from '@/types/team'

export const EVENT_ROWS = 18
export const MIN_KICK_COLUMNS = 12

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

export function scoresheetRosterRows(limit: number | null | undefined): number {
  if (limit == null || !Number.isInteger(limit)) return MAX_PLAYERS_PER_TEAM
  if (limit < MIN_PLAYERS_PER_TEAM || limit > MAX_PLAYERS_PER_TEAM) return MAX_PLAYERS_PER_TEAM
  return limit
}

export function rosterSheetsCount(rows: number, ...rosters: Player[][]): number {
  const largest = Math.max(0, ...rosters.map((roster) => roster.length))
  return Math.max(1, Math.ceil(largest / rows))
}

export function rosterSheet(roster: Player[], sheet: number, rows: number): (Player | null)[] {
  const start = sheet * rows
  return Array.from({ length: rows }, (_, index) => roster[start + index] ?? null)
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

export function scoresheetFilled(game: Pick<Game, 'status'>, blankRequested = false): boolean {
  return game.status === 'finished' && !blankRequested
}

export function printsPenaltiesSheet(game: Game, filled: boolean): boolean {
  if (filled) return savedKicks(game).length > 0
  if (game.status !== 'finished') return !!game.penalties_possible
  return !!game.penalties_possible && hasShootout(game)
}

export interface ScoresheetEvent {
  id: number
  minute: number | null
  type: string
  side: TeamSide
  number: number | null
  athlete: string
  assistNumber: number | null
  observation: string
}

export interface ScoresheetEventRow {
  index: number
  event: ScoresheetEvent | null
}

function eventMinuteRank(event: GameEvent): number {
  return event.minute ?? Number.MAX_SAFE_INTEGER
}

export function scoresheetEvents(game: Game): ScoresheetEvent[] {
  return [...(game.events ?? [])]
    .sort((a, b) => eventMinuteRank(a) - eventMinuteRank(b) || a.id - b.id)
    .map((event) => ({
      id: event.id,
      minute: event.minute,
      type: event.type,
      side: event.team_id === game.home_team_id ? 'home' : 'away',
      number: event.player?.number ?? null,
      athlete: event.player?.name ?? '',
      assistNumber: event.related_player?.number ?? null,
      observation: event.related_player ? `Assist.: ${event.related_player.name}` : '',
    }))
}

export function eventSheetsCount(events: unknown[]): number {
  return Math.max(1, Math.ceil(events.length / EVENT_ROWS))
}

export function eventSheet(events: ScoresheetEvent[], sheet: number): ScoresheetEventRow[] {
  const start = sheet * EVENT_ROWS
  return Array.from({ length: EVENT_ROWS }, (_, index) => ({
    index: start + index + 1,
    event: events[start + index] ?? null,
  }))
}

export function scoresheetEventTypes(
  active: EventTypeMeta[],
  events: Pick<ScoresheetEvent, 'type'>[],
  bySlug: (slug: string) => EventTypeMeta,
): EventTypeMeta[] {
  const known = new Set(active.map((type) => type.slug))
  const missing = new Set(events.map((event) => event.type).filter((slug) => !known.has(slug)))
  return [...active, ...[...missing].map(bySlug)]
}

export interface ScoresheetKick {
  label: string
  scored: boolean
}

export interface ScoresheetShootoutSide {
  first: boolean
  goals: string
  won: boolean
  kicks: ScoresheetKick[]
}

export interface ScoresheetShootout {
  columns: number
  home: ScoresheetShootoutSide
  away: ScoresheetShootoutSide
}

function kickLabel(kick: GamePenaltyKick): string {
  return String(kick.player?.number ?? teamInitials(kick.player ?? undefined))
}

export function scoresheetShootout(game: Game, filled: boolean): ScoresheetShootout {
  const kicks = filled ? savedKicks(game) : []
  const goalsOf = (teamId: number) =>
    kicks.filter((kick) => kick.team_id === teamId && kick.scored).length
  const side = (teamId: number, opponentId: number): ScoresheetShootoutSide => ({
    first: kicks[0]?.team_id === teamId,
    goals: kicks.length ? String(goalsOf(teamId)) : '',
    won: goalsOf(teamId) > goalsOf(opponentId),
    kicks: kicks
      .filter((kick) => kick.team_id === teamId)
      .map((kick) => ({ label: kickLabel(kick), scored: kick.scored })),
  })
  return {
    columns: Math.max(
      MIN_KICK_COLUMNS,
      shootoutColumns(kicks, game.home_team_id, game.away_team_id),
    ),
    home: side(game.home_team_id, game.away_team_id),
    away: side(game.away_team_id, game.home_team_id),
  }
}

export interface ScoresheetTeam {
  name: string
  initials: string
  logo: string | null
  coach: string | null
  roster: Player[]
  score: string
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
  filled: boolean
  penalties: boolean
  penaltiesScore: string | null
  penaltiesPage: number
  rosterRows: number
  rosterSheets: number
  eventSheets: number
  events: ScoresheetEvent[]
  shootout: ScoresheetShootout
}

export interface RosterAboveLimit {
  name: string
  players: number
}

export function rostersAboveLimit(
  data: Pick<ScoresheetData, 'home' | 'away' | 'rosterRows'>,
): RosterAboveLimit[] {
  return [data.home, data.away]
    .filter((team) => team.roster.length > data.rosterRows)
    .map((team) => ({ name: team.name, players: team.roster.length }))
}

export interface ScoresheetContext {
  championship?: string | null
  league?: string | null
  groupsCount?: number | null
}

function scoresheetTeam(
  team: Team | undefined,
  fallback: string,
  score: number | null,
): ScoresheetTeam {
  return {
    name: team?.name || fallback,
    initials: teamInitials(team),
    logo: team?.logo ?? null,
    coach: headCoachName(team),
    roster: sortRoster(team?.players),
    score: String(score ?? ''),
  }
}

export function buildScoresheet(
  game: Game,
  context: ScoresheetContext = {},
  blankRequested = false,
): ScoresheetData {
  const filled = scoresheetFilled(game, blankRequested)
  const home = scoresheetTeam(game.homeTeam, 'Mandante', filled ? game.home_score : null)
  const away = scoresheetTeam(game.awayTeam, 'Visitante', filled ? game.away_score : null)
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
  const events = filled ? scoresheetEvents(game) : []
  const rosterRows = scoresheetRosterRows(game.league?.max_players_per_team)
  const rosterSheets = rosterSheetsCount(rosterRows, home.roster, away.roster)
  const eventSheets = eventSheetsCount(events)
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
    filled,
    penalties: printsPenaltiesSheet(game, filled),
    penaltiesScore:
      filled && hasPenalties(game) ? `${game.home_penalties} × ${game.away_penalties}` : null,
    penaltiesPage: rosterSheets + eventSheets + 1,
    rosterRows,
    rosterSheets,
    eventSheets,
    events,
    shootout: scoresheetShootout(game, filled),
  }
}
