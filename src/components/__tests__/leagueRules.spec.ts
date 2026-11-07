import { describe, expect, it } from 'vitest'
import {
  addTiebreaker,
  availableTiebreakers,
  knockoutTiebreakerKey,
  knockoutTiebreakerSequence,
  moveTiebreaker,
  normalizeTiebreakers,
  removeTiebreaker,
  rulesSummary,
  tiebreakersPayload,
  toRulesForm,
  toRulesPayload,
  validateRules,
} from '@/components/leagues/leagueRules'
import { DEFAULT_TIEBREAKERS, type LeagueRules } from '@/types/leagueRules'

function rules(extra: Partial<LeagueRules> = {}): LeagueRules {
  return {
    fixture_mode: 'manual',
    groups_count: 1,
    group_legs: 1,
    qualifiers_per_group: null,
    knockout_size: null,
    knockout_legs: null,
    final_legs: null,
    third_place: false,
    tiebreakers: null,
    knockout_tiebreakers: null,
    ...extra,
  }
}

const HYBRID_DRAW = rules({
  fixture_mode: 'draw',
  groups_count: 4,
  qualifiers_per_group: 2,
  knockout_size: 8,
  knockout_legs: 1,
  final_legs: 1,
  knockout_tiebreakers: ['penalties'],
})

describe('toRulesForm / toRulesPayload', () => {
  it('liga sem configuração usa os padrões do backend e a lista padrão de critérios', () => {
    const form = toRulesForm({})

    expect(form).toEqual({
      fixture_mode: 'manual',
      groups_count: 1,
      group_legs: 1,
      qualifiers_per_group: null,
      knockout_size: null,
      knockout_legs: null,
      final_legs: null,
      third_place: false,
      tiebreakers: DEFAULT_TIEBREAKERS,
      knockout_tiebreakers: null,
    })
    expect(toRulesPayload(form, 'hybrid')).toEqual(rules())
  })

  it('ida e volta: a sequência da API vira a opção do select e volta igual no payload', () => {
    const form = toRulesForm({ knockout_tiebreakers: ['away_goals', 'better_campaign'] })

    expect(form.knockout_tiebreakers).toBe('away_goals,better_campaign')
    expect(toRulesPayload(form, 'hybrid').knockout_tiebreakers).toEqual([
      'away_goals',
      'better_campaign',
    ])
  })

  it('pontos corridos zera os campos do mata-mata e fixa um grupo', () => {
    const form = toRulesForm({ ...HYBRID_DRAW, third_place: true })

    expect(toRulesPayload(form, 'round_robin')).toEqual(
      rules({ fixture_mode: 'draw', third_place: false }),
    )
  })

  it('mata-mata força tabela manual, sem grupos e sem classificados', () => {
    const payload = toRulesPayload(toRulesForm(HYBRID_DRAW), 'knockout')

    expect(payload).toMatchObject({
      fixture_mode: 'manual',
      groups_count: 1,
      qualifiers_per_group: null,
      knockout_size: 8,
      knockout_tiebreakers: ['penalties'],
    })
  })

  it('híbrido manual vai sempre com um grupo; no sorteio vale o número escolhido', () => {
    const form = toRulesForm({ ...HYBRID_DRAW, fixture_mode: 'manual' })

    expect(form.groups_count).toBe(4)
    expect(toRulesPayload(form, 'hybrid').groups_count).toBe(1)
    expect(toRulesPayload({ ...form, fixture_mode: 'draw' }, 'hybrid').groups_count).toBe(4)
  })

  it('critérios iguais ao padrão vão como null; personalizados vão como lista', () => {
    expect(
      toRulesPayload(toRulesForm({ tiebreakers: [...DEFAULT_TIEBREAKERS] }), 'round_robin')
        .tiebreakers,
    ).toBeNull()
    expect(
      toRulesPayload(toRulesForm({ tiebreakers: ['points', 'goals_for'] }), 'round_robin')
        .tiebreakers,
    ).toEqual(['points', 'goals_for'])
  })
})

describe('lista de critérios de desempate', () => {
  it('null da API mostra o padrão, e Pontos sempre fica em primeiro, sem repetição', () => {
    expect(normalizeTiebreakers(null)).toEqual(DEFAULT_TIEBREAKERS)
    expect(normalizeTiebreakers(['wins', 'points', 'wins', 'goals_for'])).toEqual([
      'points',
      'wins',
      'goals_for',
    ])
  })

  it('inclui só critério que ainda não está na lista', () => {
    const list = normalizeTiebreakers(['points', 'wins'])

    expect(addTiebreaker(list, 'goals_against')).toEqual(['points', 'wins', 'goals_against'])
    expect(addTiebreaker(list, 'wins')).toBe(list)
    expect(availableTiebreakers(DEFAULT_TIEBREAKERS)).toEqual([
      'goals_against',
      'fewer_red_cards',
      'fewer_yellow_cards',
    ])
  })

  it('Pontos não pode ser removido nem movido, e nada passa à frente dele', () => {
    const list = normalizeTiebreakers(['points', 'wins', 'goals_for'])

    expect(removeTiebreaker(list, 0)).toBe(list)
    expect(moveTiebreaker(list, 0, 1)).toBe(list)
    expect(moveTiebreaker(list, 1, -1)).toBe(list)
    expect(moveTiebreaker(list, 2, 1)).toBe(list)
    expect(moveTiebreaker(list, 2, -1)).toEqual(['points', 'goals_for', 'wins'])
    expect(moveTiebreaker(list, 1, 1)).toEqual(['points', 'goals_for', 'wins'])
    expect(removeTiebreaker(list, 1)).toEqual(['points', 'goals_for'])
  })

  it('restaurar o padrão faz a lista ir como null', () => {
    expect(tiebreakersPayload([...DEFAULT_TIEBREAKERS])).toBeNull()
    expect(tiebreakersPayload(moveTiebreaker(DEFAULT_TIEBREAKERS, 2, -1))).toEqual([
      'points',
      'goal_difference',
      'wins',
      'goals_for',
      'head_to_head',
      'fewer_cards',
    ])
  })
})

describe('desempate do mata-mata', () => {
  it.each([
    [['penalties'], 'penalties'],
    [['better_campaign'], 'better_campaign'],
    [['away_goals', 'penalties'], 'away_goals,penalties'],
    [['away_goals', 'better_campaign'], 'away_goals,better_campaign'],
  ] as const)('%j ↔ %s', (sequence, key) => {
    expect(knockoutTiebreakerKey([...sequence])).toBe(key)
    expect(knockoutTiebreakerSequence(key)).toEqual(sequence)
  })

  it('sequência fora das 4 opções e null não viram opção', () => {
    expect(knockoutTiebreakerKey(['penalties', 'away_goals'])).toBeNull()
    expect(knockoutTiebreakerKey(null)).toBeNull()
    expect(knockoutTiebreakerSequence(null)).toBeNull()
  })
})

describe('validateRules (espelha o backend)', () => {
  it('híbrido com sorteio completo e 16 times passa', () => {
    expect(validateRules(HYBRID_DRAW, { format: 'hybrid', teamsCount: 16 })).toEqual({})
  })

  it('híbrido com sorteio exige classificados, mata-mata, jogos e desempate', () => {
    const errors = validateRules(rules({ fixture_mode: 'draw', groups_count: 2 }), {
      format: 'hybrid',
      teamsCount: 8,
    })

    expect(Object.keys(errors).sort()).toEqual([
      'final_legs',
      'knockout_legs',
      'knockout_size',
      'knockout_tiebreakers',
      'qualifiers_per_group',
    ])
    expect(errors.knockout_size).toBe('Obrigatório para o sorteio.')
  })

  it('híbrido manual não exige o mata-mata, mas confere grupos × classificados', () => {
    expect(validateRules(rules(), { format: 'hybrid', teamsCount: 16 })).toEqual({})

    const errors = validateRules(rules({ qualifiers_per_group: 2, knockout_size: 4 }), {
      format: 'hybrid',
      teamsCount: 16,
    })
    expect(errors).toEqual({
      knockout_size:
        'O tamanho do mata-mata deve ser igual a grupos × classificados por grupo (2).',
    })
  })

  it('híbrido manual tem um único grupo', () => {
    expect(validateRules(rules({ groups_count: 4 }), { format: 'hybrid', teamsCount: 16 })).toEqual(
      { groups_count: 'Ligas com tabela manual têm um único grupo.' },
    )
    expect(
      validateRules(rules({ qualifiers_per_group: 4, knockout_size: 4 }), {
        format: 'hybrid',
        teamsCount: 16,
      }),
    ).toEqual({})
  })

  it('mata-mata: só manual, sem grupos e sem classificados', () => {
    const errors = validateRules(
      rules({ fixture_mode: 'draw', groups_count: 2, qualifiers_per_group: 1 }),
      { format: 'knockout', teamsCount: 8 },
    )

    expect(errors).toEqual({
      fixture_mode: 'Ligas mata-mata só aceitam tabela manual.',
      groups_count: 'Ligas mata-mata não usam grupos.',
      qualifiers_per_group: 'Ligas mata-mata não usam classificados por grupo.',
    })
  })

  it('pontos corridos: um grupo e nenhum campo de mata-mata', () => {
    const errors = validateRules(rules({ groups_count: 2, third_place: true, final_legs: 1 }), {
      format: 'round_robin',
      teamsCount: 8,
    })

    expect(errors).toEqual({
      groups_count: 'Ligas de pontos corridos têm um único grupo.',
      third_place: 'Ligas de pontos corridos não têm mata-mata.',
      final_legs: 'Ligas de pontos corridos não têm mata-mata.',
    })
  })

  it('gol fora só com ida e volta no mata-mata ou na final', () => {
    const awayGoals = {
      ...HYBRID_DRAW,
      knockout_tiebreakers: ['away_goals', 'penalties'],
    } as LeagueRules

    expect(validateRules(awayGoals, { format: 'hybrid', teamsCount: 16 })).toEqual({
      knockout_tiebreakers: 'O gol fora de casa só vale com confrontos de ida e volta.',
    })
    expect(
      validateRules({ ...awayGoals, final_legs: 2 }, { format: 'hybrid', teamsCount: 16 }),
    ).toEqual({})
    expect(
      validateRules({ ...awayGoals, knockout_legs: 2 }, { format: 'hybrid', teamsCount: 16 }),
    ).toEqual({})
  })

  it('critérios: Pontos em primeiro e sem repetir', () => {
    expect(
      validateRules(rules({ tiebreakers: ['wins', 'points'] }), {
        format: 'round_robin',
        teamsCount: 4,
      }).tiebreakers,
    ).toBe('O primeiro critério de desempate deve ser Pontos.')
    expect(
      validateRules(rules({ tiebreakers: ['points', 'wins', 'wins'] }), {
        format: 'round_robin',
        teamsCount: 4,
      }).tiebreakers,
    ).toBe('Os critérios de desempate não podem se repetir.')
  })

  it('times da liga divisíveis pelos grupos, com 2 ou mais por grupo e classificados menores que o grupo', () => {
    expect(validateRules(HYBRID_DRAW, { format: 'hybrid', teamsCount: 18 })).toEqual({
      groups_count: 'A liga tem 18 times, que não podem ser divididos igualmente em 4 grupos.',
    })
    expect(
      validateRules(
        { ...HYBRID_DRAW, groups_count: 8, qualifiers_per_group: 1 },
        { format: 'hybrid', teamsCount: 8 },
      ),
    ).toEqual({ groups_count: 'Cada grupo precisa ter pelo menos 2 times.' })
    expect(validateRules(HYBRID_DRAW, { format: 'hybrid', teamsCount: 8 })).toEqual({
      qualifiers_per_group:
        'Os classificados por grupo devem ser menos que os 2 times de cada grupo.',
    })
  })

  it('a conta dos times só é conferida no sorteio, com times na liga e quando grupos/classificados/modo mudam', () => {
    const manual = {
      ...HYBRID_DRAW,
      fixture_mode: 'manual',
      groups_count: 1,
      qualifiers_per_group: 8,
    } as LeagueRules
    expect(validateRules(manual, { format: 'hybrid', teamsCount: 18 })).toEqual({})
    expect(validateRules(HYBRID_DRAW, { format: 'hybrid', teamsCount: 0 })).toEqual({})
    expect(
      validateRules(HYBRID_DRAW, { format: 'hybrid', teamsCount: 18, saved: HYBRID_DRAW }),
    ).toEqual({})
    expect(
      validateRules(
        { ...HYBRID_DRAW, third_place: true },
        { format: 'hybrid', teamsCount: 18, saved: HYBRID_DRAW },
      ),
    ).toEqual({})
    expect(
      validateRules(HYBRID_DRAW, {
        format: 'hybrid',
        teamsCount: 18,
        saved: { ...HYBRID_DRAW, groups_count: 2 },
      }).groups_count,
    ).toContain('18 times')
  })
})

describe('rulesSummary', () => {
  it('híbrido fechando a conta', () => {
    expect(rulesSummary(HYBRID_DRAW, 'hybrid', 16)).toEqual({
      steps: ['16 times', '4 grupos de 4', '8 classificados', 'Quartas de final'],
      problem: null,
    })
  })

  it.each([
    [{ groups_count: 3 }, 16, '16 times não podem ser divididos igualmente em 3 grupos.'],
    [{ groups_count: 8, qualifiers_per_group: 1 }, 8, 'Cada grupo precisa ter pelo menos 2 times.'],
    [
      { qualifiers_per_group: 4 },
      16,
      'Os classificados por grupo devem ser menos que os 4 times de cada grupo.',
    ],
    [
      { groups_count: 2, qualifiers_per_group: 3, knockout_size: 8 },
      16,
      '6 classificados não formam um mata-mata: são necessários 2, 4, 8 ou 16.',
    ],
    [{ knockout_size: 4 }, 16, 'Semifinal precisa de 4 classificados, mas 4 × 2 = 8.'],
    [{}, 0, 'Adicione times à liga para conferir a divisão dos grupos.'],
  ] as const)(
    'mostra o motivo quando a conta não fecha (%j, %i times)',
    (extra, teams, problem) => {
      expect(rulesSummary({ ...HYBRID_DRAW, ...extra }, 'hybrid', teams).problem).toBe(problem)
    },
  )

  it('híbrido incompleto mostra só o que já foi definido', () => {
    expect(rulesSummary(rules({ groups_count: 2 }), 'hybrid', 8)).toEqual({
      steps: ['8 times', '2 grupos de 4'],
      problem: null,
    })
  })

  it('pontos corridos e mata-mata', () => {
    expect(rulesSummary(rules({ group_legs: 2 }), 'round_robin', 10).steps).toEqual([
      '10 times',
      'Pontos corridos',
      'Turno e returno',
    ])
    expect(rulesSummary(rules({ knockout_size: 16 }), 'knockout', 16).steps).toEqual([
      '16 times',
      'Mata-mata',
      'Oitavas de final',
    ])
  })

  it('sem o número de times (grupos não carregaram) a conta não usa times', () => {
    expect(rulesSummary(HYBRID_DRAW, 'hybrid', null)).toEqual({
      steps: ['4 grupos', '8 classificados', 'Quartas de final'],
      problem: null,
    })
  })
})
