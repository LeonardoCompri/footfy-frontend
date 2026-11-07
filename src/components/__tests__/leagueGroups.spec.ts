import { describe, expect, it } from 'vitest'
import {
  arrangeGroups,
  groupLetter,
  groupMap,
  groupName,
  groupsPayload,
  groupStructureProblem,
  groupTeams,
  hasAssignedTeams,
  sameGroupMap,
  validateGroups,
} from '@/components/leagues/leagueGroups'
import type { GroupTeam, LeagueGroups } from '@/types/leagueRules'

const team = (id: number, name: string): GroupTeam => ({ id, name, nickname: null, logo: null })

const TEAMS = [team(1, 'Bahia'), team(2, 'Vitória'), team(3, 'Sport'), team(4, 'Náutico')]

function groupsData(extra: Partial<LeagueGroups> = {}): LeagueGroups {
  return {
    league_id: 1,
    fixture_mode: 'draw',
    groups_count: 2,
    locked: false,
    groups: [
      { group_number: 1, teams: [TEAMS[0], TEAMS[1]] },
      { group_number: 2, teams: [TEAMS[2]] },
    ],
    unassigned: [TEAMS[3]],
    ...extra,
  }
}

describe('montagem dos grupos', () => {
  it('grupo 1 é o A, o 2 é o B', () => {
    expect([1, 2, 16].map(groupName)).toEqual(['Grupo A', 'Grupo B', 'Grupo P'])
    expect(groupLetter(3)).toBe('C')
  })

  it('lê a resposta da API: times em ordem alfabética e o grupo de cada um', () => {
    const data = groupsData()

    expect(groupTeams(data).map((t) => t.name)).toEqual(['Bahia', 'Náutico', 'Sport', 'Vitória'])
    expect(groupMap(data)).toEqual({ 1: 1, 2: 1, 3: 2, 4: null })
    expect(hasAssignedTeams(groupMap(data))).toBe(true)
    expect(hasAssignedTeams({ 1: null, 2: null })).toBe(false)
  })

  it('mover um time muda o grupo dele e a lista de sem grupo', () => {
    const data = groupsData()
    const moved = { ...groupMap(data), 4: 2 }
    const { groups, unassigned } = arrangeGroups(groupTeams(data), moved, 2)

    expect(groups.map((g) => g.teams.map((t) => t.name))).toEqual([
      ['Bahia', 'Vitória'],
      ['Náutico', 'Sport'],
    ])
    expect(unassigned).toEqual([])
    expect(sameGroupMap(moved, groupMap(data))).toBe(false)
    expect(sameGroupMap({ ...groupMap(data) }, groupMap(data))).toBe(true)
  })

  it('grupo fora do intervalo de grupos vai para sem grupo', () => {
    const { unassigned } = arrangeGroups(TEAMS, { 1: 1, 2: 1, 3: 2, 4: 3 }, 2)
    expect(unassigned.map((t) => t.id)).toEqual([4])
  })

  it('valida antes de enviar: todos atribuídos e grupos do mesmo tamanho', () => {
    expect(validateGroups(TEAMS, { 1: 1, 2: 1, 3: 2, 4: null }, 2)).toBe(
      'Todos os times da liga devem ser atribuídos a um grupo.',
    )
    expect(validateGroups(TEAMS, { 1: 1, 2: 1, 3: 1, 4: 2 }, 2)).toBe(
      'Todos os grupos devem ter o mesmo número de times (2 por grupo).',
    )
    expect(validateGroups(TEAMS, { 1: 1, 2: 2, 3: 1, 4: 2 }, 2)).toBeNull()
  })

  it('a divisão precisa fechar: times na liga, divisível e 2 ou mais por grupo', () => {
    expect(groupStructureProblem(0, 2)).toBe('A liga não tem times para distribuir nos grupos.')
    expect(groupStructureProblem(10, 4)).toBe(
      'A liga tem 10 times, que não podem ser divididos igualmente em 4 grupos.',
    )
    expect(groupStructureProblem(4, 4)).toBe('Cada grupo precisa ter pelo menos 2 times.')
    expect(groupStructureProblem(8, 4)).toBeNull()
    expect(validateGroups(TEAMS.slice(0, 3), { 1: 1, 2: 2, 3: 2 }, 2)).toBe(
      'A liga tem 3 times, que não podem ser divididos igualmente em 2 grupos.',
    )
  })

  it('payload do PUT /leagues/{id}/groups com time e número do grupo', () => {
    expect(groupsPayload(TEAMS, { 1: 1, 2: 2, 3: 1, 4: 2 })).toEqual([
      { team_id: 1, group_number: 1 },
      { team_id: 2, group_number: 2 },
      { team_id: 3, group_number: 1 },
      { team_id: 4, group_number: 2 },
    ])
  })
})
