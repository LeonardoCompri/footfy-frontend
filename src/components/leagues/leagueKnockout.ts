import type { League } from '@/types/championship'
import { formatMatchDate, scoreLabel } from '@/types/game'
import {
  KNOCKOUT_STAGES,
  type KnockoutNextStagePayload,
  type KnockoutStageKey,
  type KnockoutStepKey,
  type LeagueKnockoutState,
} from '@/types/leagueKnockout'
import type { KnockoutPhase, KnockoutTie, KnockoutTieLeg } from '@/types/leagueStats'
import { KNOCKOUT_LEGS_LABELS, KNOCKOUT_SIZES, type KnockoutSize } from '@/types/leagueRules'
import { groupName } from './leagueGroups'

export interface KnockoutConfirmation {
  firstStage: boolean
  manualTotal: number
  manualWithResults: number
}

export interface BracketConfig {
  size: KnockoutSize
  groupsCount: number
  qualifiers: number
  thirdPlace: boolean
}

export interface FutureTie {
  tie_key: string
  home: string
  away: string
}

export interface BracketSection {
  key: string
  title: string
  stage: KnockoutStageKey | null
  ties: KnockoutTie[]
  future: FutureTie[]
}

export interface TieOutcome {
  text: string
  color: string
  icon: string
}

const MAIN_STAGES: KnockoutStepKey[] = ['R16', 'QF', 'SF', 'F']

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1)
}

export function canGenerateStage(state: LeagueKnockoutState): boolean {
  return state.enabled && state.can_generate && state.next_stage !== null
}

export function canUndoStage(state: LeagueKnockoutState): boolean {
  return state.enabled && state.can_undo && state.last_stage !== null
}

export function generateLabel(state: LeagueKnockoutState): string {
  const next = state.next_stage
  if (!next) return 'Gerar fase'
  return next.with_third_place ? 'Gerar final e 3º lugar' : `Gerar ${lower(next.label)}`
}

function undoesThirdPlace(state: LeagueKnockoutState): boolean {
  return state.last_stage === 'F' && state.generated_stages.includes('3P')
}

export function undoLabel(state: LeagueKnockoutState): string {
  if (!state.last_stage) return 'Desfazer fase'
  if (undoesThirdPlace(state)) return 'Desfazer final e 3º lugar'
  return `Desfazer ${lower(KNOCKOUT_STAGES[state.last_stage].label)}`
}

export function undoMessage(state: LeagueKnockoutState): string {
  if (!state.last_stage) return ''
  const games = `As partidas ${KNOCKOUT_STAGES[state.last_stage].of} serão apagadas.`
  const thirdPlace = undoesThirdPlace(state) ? ' A disputa de 3º lugar também será desfeita.' : ''
  return `${games}${thirdPlace} Deseja continuar?`
}

export function nextStageLabel(state: LeagueKnockoutState): string | null {
  const next = state.next_stage
  if (!next) return null
  const thirdPlace = next.with_third_place ? ' + Disputa de 3º lugar' : ''
  return `Próxima: ${next.label} · ${KNOCKOUT_LEGS_LABELS[next.legs]}${thirdPlace}`
}

export function knockoutConfirmation(state: LeagueKnockoutState): KnockoutConfirmation {
  const firstStage = state.last_stage === null
  return {
    firstStage,
    manualTotal: firstStage ? state.manual_phase_games.total : 0,
    manualWithResults: firstStage ? state.manual_phase_games.with_results : 0,
  }
}

export function nextStagePayload(
  stage: KnockoutStepKey,
  confirmation: KnockoutConfirmation,
): KnockoutNextStagePayload {
  return confirmation.firstStage && confirmation.manualTotal > 0
    ? { stage, replace_manual_phases: true }
    : { stage }
}

export function manualPhaseGamesLabel(total: number): string {
  return total === 1
    ? '1 partida de mata-mata cadastrada manualmente'
    : `${total} partidas de mata-mata cadastradas manualmente`
}

export function bracketConfig(
  league:
    | Pick<
        League,
        | 'format'
        | 'fixture_mode'
        | 'groups_count'
        | 'qualifiers_per_group'
        | 'knockout_size'
        | 'third_place'
      >
    | null
    | undefined,
): BracketConfig | null {
  if (!league || league.format !== 'hybrid' || league.fixture_mode !== 'draw') return null
  const size = league.knockout_size
  const groupsCount = Math.max(1, league.groups_count ?? 1)
  const qualifiers = league.qualifiers_per_group ?? 0
  if (!size || !KNOCKOUT_SIZES.includes(size)) return null
  if (groupsCount * qualifiers !== size) return null
  if (groupsCount > 1 && groupsCount % 2 !== 0) return null
  return { size, groupsCount, qualifiers, thirdPlace: !!league.third_place }
}

export function bracketSteps(size: number, thirdPlace: boolean): KnockoutStageKey[][] {
  const steps: KnockoutStageKey[][] = MAIN_STAGES.filter(
    (key) => KNOCKOUT_STAGES[key].teams <= size,
  ).map((key) => [key])
  if (thirdPlace && size >= 4) steps[steps.length - 1].push('3P')
  return steps
}

export function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const total = order.length * 2
    order = order.flatMap((seed) => [seed, total + 1 - seed])
  }
  return order
}

function slotLabel(groupsCount: number, group: number, position: number): string {
  return groupsCount === 1 ? `${position}º colocado` : `${position}º ${groupName(group)}`
}

export function firstStagePairs(groupsCount: number, qualifiers: number): [string, string][] {
  if (groupsCount === 1) {
    const positions = seedOrder(qualifiers)
    const pairs: [string, string][] = []
    for (let index = 0; index < positions.length; index += 2) {
      pairs.push([slotLabel(1, 1, positions[index]), slotLabel(1, 1, positions[index + 1])])
    }
    return pairs
  }

  const seeds = seedOrder(qualifiers * 2)
  const couplePairs: [string, string][][] = []
  for (let first = 1; first <= groupsCount; first += 2) {
    const couple = [first, first + 1]
    const label = (seed: number) =>
      slotLabel(groupsCount, seed % 2 === 1 ? couple[0] : couple[1], Math.floor((seed + 1) / 2))
    const pairs: [string, string][] = []
    for (let index = 0; index < seeds.length; index += 2) {
      pairs.push([label(seeds[index]), label(seeds[index + 1])])
    }
    couplePairs.push(pairs)
  }

  const pairs: [string, string][] = []
  for (let tie = 0; tie < qualifiers; tie++) {
    for (const coupleTies of couplePairs) pairs.push(coupleTies[tie])
  }
  return pairs
}

function teamLabel(tie: KnockoutTie, teamId: number | null | undefined): string | null {
  if (teamId == null) return null
  const team = tie.teams.find((item) => item.team_id === teamId)
  return team ? team.nickname || team.name : null
}

function loserOf(tie: KnockoutTie): number | null {
  if (tie.winner_team_id == null) return null
  return tie.teams.find((team) => team.team_id !== tie.winner_team_id)?.team_id ?? null
}

function futureTies(
  stage: KnockoutStageKey,
  steps: KnockoutStageKey[][],
  config: BracketConfig,
  findTie: (tieKey: string) => KnockoutTie | undefined,
): FutureTie[] {
  const winner = (tieKey: string) => {
    const tie = findTie(tieKey)
    return (tie && teamLabel(tie, tie.winner_team_id)) || `Vencedor ${tieKey}`
  }
  const loser = (tieKey: string) => {
    const tie = findTie(tieKey)
    return (tie && teamLabel(tie, loserOf(tie))) || `Perdedor ${tieKey}`
  }

  if (stage === '3P') return [{ tie_key: '3P-1', home: loser('SF-1'), away: loser('SF-2') }]

  const index = steps.findIndex((step) => step[0] === stage)
  if (index === 0) {
    return firstStagePairs(config.groupsCount, config.qualifiers).map(([home, away], tie) => ({
      tie_key: `${stage}-${tie + 1}`,
      home,
      away,
    }))
  }

  const previous = steps[index - 1][0]
  return Array.from({ length: KNOCKOUT_STAGES[stage].teams / 2 }, (_, tie) => ({
    tie_key: `${stage}-${tie + 1}`,
    home: winner(`${previous}-${tie * 2 + 1}`),
    away: winner(`${previous}-${tie * 2 + 2}`),
  }))
}

export function bracketSections(
  phases: KnockoutPhase[],
  config: BracketConfig | null,
): BracketSection[] {
  const real = phases.map((phase) => ({
    order: phase.phase_order ?? Number.POSITIVE_INFINITY,
    section: {
      key: `${phase.phase_order}-${phase.phase}`,
      title: phase.phase,
      stage: phase.stage ?? null,
      ties: phase.ties,
      future: [],
    } as BracketSection,
  }))

  if (!config || phases.some((phase) => !phase.stage)) return real.map((item) => item.section)

  const generated = new Set(phases.map((phase) => phase.stage))
  const ties = phases.flatMap((phase) => phase.ties)
  const findTie = (tieKey: string) => ties.find((tie) => tie.tie_key === tieKey)
  const steps = bracketSteps(config.size, config.thirdPlace)

  const future = steps
    .flat()
    .filter((stage) => !generated.has(stage))
    .map((stage) => ({
      order: KNOCKOUT_STAGES[stage].phase_order,
      section: {
        key: `future-${stage}`,
        title: KNOCKOUT_STAGES[stage].label,
        stage,
        ties: [],
        future: futureTies(stage, steps, config, findTie),
      } as BracketSection,
    }))

  return [...real, ...future].sort((a, b) => a.order - b.order).map((item) => item.section)
}

export function tieTeamName(tie: KnockoutTie, teamId: number): string {
  return teamLabel(tie, teamId) || 'A definir'
}

function penaltiesText(tie: KnockoutTie): string {
  const decisive = tie.legs.find((leg) => leg.id === tie.decisive_game_id)
  const home = tie.home_penalties
  const away = tie.away_penalties
  if (home == null || away == null) return ''
  const winnerIsHome = decisive ? decisive.home_team_id === tie.winner_team_id : home > away
  return winnerIsHome ? ` (${home} × ${away})` : ` (${away} × ${home})`
}

const DECIDED_BY_SUFFIX = {
  aggregate: '',
  away_goals: ' pelo gol fora',
  better_campaign: ' pela melhor campanha',
} as const

export function tieOutcome(tie: KnockoutTie, stage: KnockoutStageKey | null): TieOutcome {
  if (tie.awaiting_penalties) {
    return { text: 'Aguardando pênaltis', color: 'warning', icon: 'mdi-timer-sand' }
  }
  if (!tie.decided) return { text: 'Em disputa', color: 'info', icon: 'mdi-progress-clock' }
  if (tie.winner_team_id === null) {
    return { text: 'Agregado empatado', color: 'warning', icon: 'mdi-equal' }
  }
  const prefix = stage === 'F' ? 'Campeão' : stage === '3P' ? '3º lugar' : 'Classificado'
  const suffix =
    tie.decided_by === 'penalties'
      ? ` nos pênaltis${penaltiesText(tie)}`
      : tie.decided_by
        ? DECIDED_BY_SUFFIX[tie.decided_by]
        : ''
  return {
    text: `${prefix}: ${tieTeamName(tie, tie.winner_team_id)}${suffix}`,
    color: 'success',
    icon: stage === 'F' ? 'mdi-trophy' : 'mdi-check-circle',
  }
}

export function legScore(leg: KnockoutTieLeg): string {
  if (leg.status === 'finished' && leg.home_score !== null && leg.away_score !== null) {
    return scoreLabel(leg)
  }
  return formatMatchDate(leg.match_date, false)
}
