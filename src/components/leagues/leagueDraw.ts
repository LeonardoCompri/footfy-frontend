import type { Game } from '@/types/game'
import type { DrawNextRoundPayload, LeagueDrawState } from '@/types/leagueDraw'
import type { GroupTeam } from '@/types/leagueRules'

export type Turn = 'single' | 'first' | 'second'

export const TURN_LABELS: Record<Turn, string> = {
  single: 'Turno único',
  first: 'Turno',
  second: 'Returno',
}

export interface DrawRoundGroup {
  group_number: number
  games: Game[]
  byes: GroupTeam[]
}

export interface DrawRoundView {
  round: number
  turn: Turn
  groups: DrawRoundGroup[]
}

export interface DrawConfirmation {
  firstRound: boolean
  manualTotal: number
  manualWithResults: number
  hasReturnLeg: boolean
}

export function turnOf(
  round: number,
  state: Pick<LeagueDrawState, 'group_legs' | 'rounds_per_turn'>,
): Turn {
  if (state.group_legs !== 2) return 'single'
  if (state.rounds_per_turn === null) return 'first'
  return round > state.rounds_per_turn ? 'second' : 'first'
}

export function isReturnLegGame(
  game: Pick<Game, 'round' | 'group_number'>,
  perTurn: number | null | undefined,
): boolean {
  return game.group_number != null && game.round != null && !!perTurn && game.round > perTurn
}

export function canDrawRound(state: LeagueDrawState): boolean {
  return state.can_draw && state.next_round !== null
}

export function drawConfirmation(state: LeagueDrawState): DrawConfirmation | null {
  const confirmation: DrawConfirmation = {
    firstRound: state.drawn_rounds === 0,
    manualTotal: state.manual_round_games.total,
    manualWithResults: state.manual_round_games.with_results,
    hasReturnLeg: state.group_legs === 2,
  }
  return confirmation.firstRound || confirmation.manualTotal > 0 ? confirmation : null
}

export function drawPayload(
  round: number,
  confirmation: DrawConfirmation | null,
): DrawNextRoundPayload {
  return confirmation && confirmation.manualTotal > 0
    ? { round, replace_manual_rounds: true }
    : { round }
}

export function drawRounds(state: LeagueDrawState, games: Game[]): DrawRoundView[] {
  const groupNumbers = state.groups.length ? state.groups.map((group) => group.group_number) : [1]
  const rounds: DrawRoundView[] = []

  for (let round = state.drawn_rounds; round >= 1; round--) {
    rounds.push({
      round,
      turn: turnOf(round, state),
      groups: groupNumbers.map((groupNumber) => ({
        group_number: groupNumber,
        games: games
          .filter((game) => game.round === round && game.group_number === groupNumber)
          .sort((a, b) => a.id - b.id),
        byes: (state.groups.find((group) => group.group_number === groupNumber)?.byes ?? [])
          .filter((bye) => bye.round === round)
          .map((bye) => bye.team),
      })),
    })
  }
  return rounds
}

export function progressTitle(drawn: number, total: number | null): string {
  if (drawn === 0) return 'Nenhuma rodada sorteada'
  if (total) return `Rodada ${drawn} de ${total} sorteada`
  return drawn === 1 ? '1 rodada sorteada' : `${drawn} rodadas sorteadas`
}

export function manualGamesLabel(total: number): string {
  return total === 1
    ? '1 partida de rodada cadastrada manualmente'
    : `${total} partidas de rodada cadastradas manualmente`
}
