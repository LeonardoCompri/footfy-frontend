import type { LeagueFormat } from '@/types/championship'
import {
  DEFAULT_TIEBREAKERS,
  KNOCKOUT_SIZE_LABELS,
  KNOCKOUT_SIZES,
  KNOCKOUT_TIEBREAKER_OPTIONS,
  MAX_PLAYERS_PER_TEAM,
  MIN_PLAYERS_PER_TEAM,
  TIEBREAKER_LABELS,
  GROUP_LEGS_LABELS,
  type FixtureMode,
  type KnockoutSize,
  type KnockoutTiebreaker,
  type LeagueRules,
  type Legs,
  type Tiebreaker,
} from '@/types/leagueRules'

export interface LeagueRulesForm {
  fixture_mode: FixtureMode
  groups_count: number
  group_legs: Legs
  qualifiers_per_group: number | null
  knockout_size: KnockoutSize | null
  knockout_legs: Legs | null
  final_legs: Legs | null
  third_place: boolean
  tiebreakers: Tiebreaker[]
  knockout_tiebreakers: string | null
  max_players_per_team: number | string
}

export type RulesErrors = Partial<Record<keyof LeagueRules, string>>

export interface RulesContext {
  format: LeagueFormat
  teamsCount: number | null
  saved?: Partial<LeagueRules>
}

export interface RulesSummary {
  steps: string[]
  problem: string | null
}

const KNOCKOUT_FIELDS = [
  'qualifiers_per_group',
  'knockout_size',
  'knockout_legs',
  'final_legs',
  'third_place',
  'knockout_tiebreakers',
] as const

const REQUIRED_FOR_DRAW = [
  'qualifiers_per_group',
  'knockout_size',
  'knockout_legs',
  'final_legs',
  'knockout_tiebreakers',
] as const

const TEAM_COUNT_FIELDS = ['fixture_mode', 'groups_count', 'qualifiers_per_group'] as const

export function hasGroupStage(format: LeagueFormat): boolean {
  return format !== 'knockout'
}

export function hasKnockout(format: LeagueFormat): boolean {
  return format !== 'round_robin'
}

export function normalizeTiebreakers(list: Tiebreaker[] | null | undefined): Tiebreaker[] {
  const source = list ?? DEFAULT_TIEBREAKERS
  return ['points', ...new Set(source.filter((item) => item !== 'points'))]
}

export function sameTiebreakers(a: Tiebreaker[], b: Tiebreaker[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

export function availableTiebreakers(list: Tiebreaker[]): Tiebreaker[] {
  return (Object.keys(TIEBREAKER_LABELS) as Tiebreaker[]).filter((item) => !list.includes(item))
}

export function addTiebreaker(list: Tiebreaker[], item: Tiebreaker): Tiebreaker[] {
  return list.includes(item) ? list : [...list, item]
}

export function removeTiebreaker(list: Tiebreaker[], index: number): Tiebreaker[] {
  if (index <= 0 || index >= list.length) return list
  return list.filter((_, position) => position !== index)
}

export function moveTiebreaker(list: Tiebreaker[], index: number, offset: -1 | 1): Tiebreaker[] {
  const target = index + offset
  if (index <= 0 || target <= 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function tiebreakersPayload(list: Tiebreaker[]): Tiebreaker[] | null {
  return sameTiebreakers(list, DEFAULT_TIEBREAKERS) ? null : [...list]
}

export function knockoutTiebreakerKey(
  sequence: KnockoutTiebreaker[] | null | undefined,
): string | null {
  if (!sequence) return null
  const key = sequence.join(',')
  return KNOCKOUT_TIEBREAKER_OPTIONS.find((option) => option.value === key)?.value ?? null
}

export function knockoutTiebreakerSequence(key: string | null): KnockoutTiebreaker[] | null {
  const option = KNOCKOUT_TIEBREAKER_OPTIONS.find((item) => item.value === key)
  return option ? [...option.sequence] : null
}

export function toRulesForm(league: Partial<LeagueRules>): LeagueRulesForm {
  return {
    fixture_mode: league.fixture_mode ?? 'manual',
    groups_count: league.groups_count ?? 1,
    group_legs: league.group_legs ?? 1,
    qualifiers_per_group: league.qualifiers_per_group ?? null,
    knockout_size: league.knockout_size ?? null,
    knockout_legs: league.knockout_legs ?? null,
    final_legs: league.final_legs ?? null,
    third_place: league.third_place ?? false,
    tiebreakers: normalizeTiebreakers(league.tiebreakers),
    knockout_tiebreakers: knockoutTiebreakerKey(league.knockout_tiebreakers),
    max_players_per_team: league.max_players_per_team ?? MAX_PLAYERS_PER_TEAM,
  }
}

export function toRulesPayload(form: LeagueRulesForm, format: LeagueFormat): LeagueRules {
  const payload: LeagueRules = {
    fixture_mode: form.fixture_mode,
    groups_count: form.groups_count,
    group_legs: form.group_legs,
    qualifiers_per_group: form.qualifiers_per_group,
    knockout_size: form.knockout_size,
    knockout_legs: form.knockout_legs,
    final_legs: form.final_legs,
    third_place: form.third_place,
    tiebreakers: tiebreakersPayload(form.tiebreakers),
    knockout_tiebreakers: knockoutTiebreakerSequence(form.knockout_tiebreakers),
    max_players_per_team: Number(form.max_players_per_team),
  }

  if (format === 'knockout') {
    return { ...payload, fixture_mode: 'manual', groups_count: 1, qualifiers_per_group: null }
  }

  if (format === 'round_robin') {
    return {
      ...payload,
      groups_count: 1,
      qualifiers_per_group: null,
      knockout_size: null,
      knockout_legs: null,
      final_legs: null,
      third_place: false,
      knockout_tiebreakers: null,
    }
  }

  if (payload.fixture_mode === 'manual') return { ...payload, groups_count: 1 }

  return payload
}

function teamCountFieldsChanged(rules: LeagueRules, saved?: Partial<LeagueRules>): boolean {
  if (!saved) return true
  const defaults = toRulesForm({})
  return TEAM_COUNT_FIELDS.some(
    (field) => String(rules[field] ?? '') !== String(saved[field] ?? defaults[field] ?? ''),
  )
}

export function validateRules(rules: LeagueRules, context: RulesContext): RulesErrors {
  const { format, teamsCount, saved } = context
  const errors: RulesErrors = {}

  if (format === 'knockout') {
    if (rules.fixture_mode !== 'manual') {
      errors.fixture_mode = 'Ligas mata-mata só aceitam tabela manual.'
    }
    if (rules.groups_count !== 1) errors.groups_count = 'Ligas mata-mata não usam grupos.'
    if (rules.qualifiers_per_group !== null) {
      errors.qualifiers_per_group = 'Ligas mata-mata não usam classificados por grupo.'
    }
  } else if (format === 'round_robin') {
    if (rules.groups_count !== 1) {
      errors.groups_count = 'Ligas de pontos corridos têm um único grupo.'
    }
    for (const field of KNOCKOUT_FIELDS) {
      const filled = field === 'third_place' ? rules.third_place : rules[field] !== null
      if (filled) errors[field] = 'Ligas de pontos corridos não têm mata-mata.'
    }
  } else {
    if (rules.fixture_mode === 'manual' && rules.groups_count !== 1) {
      errors.groups_count = 'Ligas com tabela manual têm um único grupo.'
    }
    if (rules.fixture_mode === 'draw') {
      for (const field of REQUIRED_FOR_DRAW) {
        if (rules[field] === null) errors[field] = 'Obrigatório para o sorteio.'
      }
    }
    const qualifiers = rules.qualifiers_per_group
    if (qualifiers !== null && rules.knockout_size !== null) {
      const total = rules.groups_count * qualifiers
      if (rules.knockout_size !== total) {
        errors.knockout_size ??= `O tamanho do mata-mata deve ser igual a grupos × classificados por grupo (${total}).`
      }
    }
  }

  const tiebreakers = rules.tiebreakers
  if (tiebreakers) {
    if (tiebreakers[0] !== 'points') {
      errors.tiebreakers = 'O primeiro critério de desempate deve ser Pontos.'
    } else if (new Set(tiebreakers).size !== tiebreakers.length) {
      errors.tiebreakers = 'Os critérios de desempate não podem se repetir.'
    }
  }

  const sequence = rules.knockout_tiebreakers
  if (sequence && !errors.knockout_tiebreakers) {
    if (!knockoutTiebreakerKey(sequence)) {
      errors.knockout_tiebreakers = 'A sequência de desempate do mata-mata é inválida.'
    } else if (
      sequence[0] === 'away_goals' &&
      rules.knockout_legs !== 2 &&
      rules.final_legs !== 2
    ) {
      errors.knockout_tiebreakers = 'O gol fora de casa só vale com confrontos de ida e volta.'
    }
  }

  if (
    Object.keys(errors).length === 0 &&
    teamsCount &&
    rules.fixture_mode === 'draw' &&
    teamCountFieldsChanged(rules, saved)
  ) {
    const groups = rules.groups_count
    if (teamsCount % groups !== 0) {
      errors.groups_count = `A liga tem ${teamsCount} times, que não podem ser divididos igualmente em ${groups} grupos.`
    } else if (teamsCount / groups < 2) {
      errors.groups_count = 'Cada grupo precisa ter pelo menos 2 times.'
    } else if (
      rules.qualifiers_per_group !== null &&
      rules.qualifiers_per_group >= teamsCount / groups
    ) {
      errors.qualifiers_per_group = `Os classificados por grupo devem ser menos que os ${teamsCount / groups} times de cada grupo.`
    }
  }

  const maxPlayers = rules.max_players_per_team
  if (
    !Number.isInteger(maxPlayers) ||
    maxPlayers < MIN_PLAYERS_PER_TEAM ||
    maxPlayers > MAX_PLAYERS_PER_TEAM
  ) {
    errors.max_players_per_team = `Informe um número inteiro de ${MIN_PLAYERS_PER_TEAM} a ${MAX_PLAYERS_PER_TEAM}.`
  }

  return errors
}

function teamsLabel(count: number): string {
  if (count === 0) return 'Nenhum time na liga'
  return count === 1 ? '1 time' : `${count} times`
}

function groupsLabel(count: number): string {
  return count === 1 ? '1 grupo' : `${count} grupos`
}

export function rulesSummary(
  rules: LeagueRules,
  format: LeagueFormat,
  teamsCount: number | null,
): RulesSummary {
  const steps = teamsCount === null ? [] : [teamsLabel(teamsCount)]

  if (format === 'round_robin') {
    return {
      steps: [...steps, 'Pontos corridos', GROUP_LEGS_LABELS[rules.group_legs]],
      problem: null,
    }
  }

  if (format === 'knockout') {
    const start = rules.knockout_size ? [KNOCKOUT_SIZE_LABELS[rules.knockout_size]] : []
    return { steps: [...steps, 'Mata-mata', ...start], problem: null }
  }

  const groups = rules.groups_count
  const qualifiers = rules.qualifiers_per_group
  let problem: string | null = null
  let groupSize: number | null = null

  if (teamsCount === 0) {
    problem = 'Adicione times à liga para conferir a divisão dos grupos.'
    steps.push(groupsLabel(groups))
  } else if (teamsCount !== null && teamsCount % groups !== 0) {
    problem = `${teamsCount} times não podem ser divididos igualmente em ${groups} grupos.`
    steps.push(groupsLabel(groups))
  } else if (teamsCount !== null) {
    groupSize = teamsCount / groups
    steps.push(`${groupsLabel(groups)} de ${groupSize}`)
    if (groupSize < 2) problem = 'Cada grupo precisa ter pelo menos 2 times.'
  } else {
    steps.push(groupsLabel(groups))
  }

  if (qualifiers !== null) {
    const total = groups * qualifiers
    steps.push(total === 1 ? '1 classificado' : `${total} classificados`)
    if (!problem && groupSize !== null && qualifiers >= groupSize) {
      problem = `Os classificados por grupo devem ser menos que os ${groupSize} times de cada grupo.`
    }
    if (!problem && !KNOCKOUT_SIZES.includes(total as KnockoutSize)) {
      problem = `${total} classificados não formam um mata-mata: são necessários 2, 4, 8 ou 16.`
    }
  }

  if (rules.knockout_size !== null) {
    const label = KNOCKOUT_SIZE_LABELS[rules.knockout_size]
    steps.push(label)
    if (!problem && qualifiers !== null && rules.knockout_size !== groups * qualifiers) {
      problem = `${label} precisa de ${rules.knockout_size} classificados, mas ${groups} × ${qualifiers} = ${groups * qualifiers}.`
    }
  }

  return { steps, problem }
}
