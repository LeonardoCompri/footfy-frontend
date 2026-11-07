import type { League } from '@/types/championship'
import type { LeagueTable, StandingGroup, StandingRow } from '@/types/leagueStats'
import { DEFAULT_TIEBREAKERS, TIEBREAKER_LABELS, type Tiebreaker } from '@/types/leagueRules'

export const TIED_LABEL = 'Empate técnico: ordem alfabética'

export function tiebreakerLegend(tiebreakers?: Tiebreaker[] | null): string {
  const labels = (tiebreakers ?? DEFAULT_TIEBREAKERS)
    .filter((tiebreaker) => tiebreaker !== 'points' && TIEBREAKER_LABELS[tiebreaker])
    .map((tiebreaker) => {
      const label = TIEBREAKER_LABELS[tiebreaker]
      return label.charAt(0).toLowerCase() + label.slice(1)
    })
  if (labels.length === 0) return 'Desempate: ordem alfabética.'
  const last = labels.pop() as string
  return `Desempate: ${labels.length ? `${labels.join(', ')} e ${last}` : last}.`
}

export function standingGroups(table: LeagueTable): StandingGroup[] {
  if (table.groups && table.groups.length > 1) return table.groups
  return [{ group_number: 1, standings: table.standings ?? [] }]
}

export function ungroupedRows(table: LeagueTable): StandingRow[] {
  if (!table.groups || table.groups.length < 2) return []
  const grouped = new Set(
    table.groups.flatMap((group) => group.standings.map((row) => row.team_id)),
  )
  return (table.standings ?? []).filter((row) => !grouped.has(row.team_id))
}

export function hasTied(groups: StandingGroup[]): boolean {
  return groups.some((group) => group.standings.some((row) => row.tied))
}

export function groupQualifiers(
  league: Pick<League, 'format' | 'fixture_mode' | 'qualifiers_per_group'> | null | undefined,
): number | null {
  if (!league || league.format !== 'hybrid' || league.fixture_mode !== 'draw') return null
  return league.qualifiers_per_group || null
}
