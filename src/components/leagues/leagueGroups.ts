import type { GroupAssignment, GroupTeam, LeagueGroup, LeagueGroups } from '@/types/leagueRules'

export type GroupMap = Record<number, number | null>

export interface ArrangedGroups {
  groups: LeagueGroup[]
  unassigned: GroupTeam[]
}

export function groupLetter(groupNumber: number): string {
  return String.fromCharCode(64 + groupNumber)
}

export function groupName(groupNumber: number): string {
  return `Grupo ${groupLetter(groupNumber)}`
}

export function groupTeams(data: LeagueGroups): GroupTeam[] {
  return [...data.groups.flatMap((group) => group.teams), ...data.unassigned].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  )
}

export function groupMap(data: LeagueGroups): GroupMap {
  const map: GroupMap = {}
  for (const group of data.groups) {
    for (const team of group.teams) map[team.id] = group.group_number
  }
  for (const team of data.unassigned) map[team.id] = null
  return map
}

export function hasAssignedTeams(map: GroupMap): boolean {
  return Object.values(map).some((groupNumber) => groupNumber !== null)
}

export function sameGroupMap(a: GroupMap, b: GroupMap): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[+key] === b[+key])
}

export function arrangeGroups(
  teams: GroupTeam[],
  map: GroupMap,
  groupsCount: number,
): ArrangedGroups {
  const groups = Array.from({ length: groupsCount }, (_, index) => ({
    group_number: index + 1,
    teams: [] as GroupTeam[],
  }))
  const unassigned: GroupTeam[] = []

  for (const team of teams) {
    const groupNumber = map[team.id] ?? null
    const group = groupNumber === null ? undefined : groups[groupNumber - 1]
    if (group) group.teams.push(team)
    else unassigned.push(team)
  }

  return { groups, unassigned }
}

export function groupStructureProblem(teamsCount: number, groupsCount: number): string | null {
  if (teamsCount === 0) return 'A liga não tem times para distribuir nos grupos.'
  if (teamsCount % groupsCount !== 0) {
    return `A liga tem ${teamsCount} times, que não podem ser divididos igualmente em ${groupsCount} grupos.`
  }
  if (teamsCount / groupsCount < 2) return 'Cada grupo precisa ter pelo menos 2 times.'
  return null
}

export function validateGroups(
  teams: GroupTeam[],
  map: GroupMap,
  groupsCount: number,
): string | null {
  const structure = groupStructureProblem(teams.length, groupsCount)
  if (structure) return structure

  const { groups, unassigned } = arrangeGroups(teams, map, groupsCount)
  if (unassigned.length) return 'Todos os times da liga devem ser atribuídos a um grupo.'

  const groupSize = teams.length / groupsCount
  if (groups.some((group) => group.teams.length !== groupSize)) {
    return `Todos os grupos devem ter o mesmo número de times (${groupSize} por grupo).`
  }
  return null
}

export function groupsPayload(teams: GroupTeam[], map: GroupMap): GroupAssignment[] {
  return teams.flatMap((team) => {
    const groupNumber = map[team.id]
    return groupNumber ? [{ team_id: team.id, group_number: groupNumber }] : []
  })
}
