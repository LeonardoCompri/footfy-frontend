import { describe, expect, it } from 'vitest'
import {
  groupQualifiers,
  hasTied,
  standingGroups,
  tiebreakerLegend,
  ungroupedRows,
} from '@/components/leagues/standings'
import type { StandingRow } from '@/types/leagueStats'

const row = (id: number, tied = false) => ({ team_id: id, tied }) as StandingRow

describe('standings — legenda e grupos da classificação', () => {
  it('legenda de desempate segue tiebreakers, sem pontos e com rótulos em pt-BR', () => {
    expect(tiebreakerLegend(['points', 'goals_against', 'head_to_head', 'fewer_red_cards'])).toBe(
      'Desempate: menos gols sofridos, confronto direto e menos cartões vermelhos.',
    )
    expect(tiebreakerLegend(['points', 'wins'])).toBe('Desempate: vitórias.')
    expect(tiebreakerLegend(['points'])).toBe('Desempate: ordem alfabética.')
  })

  it('sem tiebreakers (API antiga) usa o padrão', () => {
    const expected =
      'Desempate: vitórias, saldo de gols, gols marcados, confronto direto e menos cartões.'
    expect(tiebreakerLegend(undefined)).toBe(expected)
    expect(tiebreakerLegend(null)).toBe(expected)
  })

  it('usa groups com 2+ grupos e cai em standings com 1 grupo ou sem groups', () => {
    const groups = [
      { group_number: 1, standings: [row(1)] },
      { group_number: 2, standings: [row(2)] },
    ]
    expect(standingGroups({ standings: [row(1), row(2)], groups })).toBe(groups)
    expect(
      standingGroups({ standings: [row(1), row(2)], groups: [groups[0]] })[0].standings,
    ).toHaveLength(2)
    expect(standingGroups({ standings: [row(3)] })).toEqual([
      { group_number: 1, standings: [row(3)] },
    ])
  })

  it('times fora dos grupos só com 2+ grupos, na ordem da classificação geral', () => {
    const groups = [
      { group_number: 1, standings: [row(1)] },
      { group_number: 2, standings: [] },
    ]
    expect(ungroupedRows({ standings: [row(3), row(1), row(2)], groups })).toEqual([row(3), row(2)])
    expect(ungroupedRows({ standings: [row(1), row(2)], groups: [groups[0]] })).toEqual([])
    expect(ungroupedRows({ phases: [] })).toEqual([])
  })

  it('detecta empate técnico em qualquer grupo', () => {
    expect(hasTied([{ group_number: 1, standings: [row(1), row(2)] }])).toBe(false)
    expect(
      hasTied([
        { group_number: 1, standings: [row(1)] },
        { group_number: 2, standings: [row(2, true)] },
      ]),
    ).toBe(true)
  })

  it('classificados por grupo só em grupos + mata-mata com sorteio', () => {
    expect(
      groupQualifiers({ format: 'hybrid', fixture_mode: 'draw', qualifiers_per_group: 2 }),
    ).toBe(2)
    expect(
      groupQualifiers({ format: 'hybrid', fixture_mode: 'manual', qualifiers_per_group: 2 }),
    ).toBeNull()
    expect(
      groupQualifiers({ format: 'round_robin', fixture_mode: 'draw', qualifiers_per_group: 2 }),
    ).toBeNull()
    expect(
      groupQualifiers({ format: 'hybrid', fixture_mode: 'draw', qualifiers_per_group: null }),
    ).toBeNull()
    expect(groupQualifiers(null)).toBeNull()
  })
})
