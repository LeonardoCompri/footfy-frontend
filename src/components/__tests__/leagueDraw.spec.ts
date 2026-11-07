import { describe, expect, it } from 'vitest'
import {
  canDrawRound,
  drawConfirmation,
  drawPayload,
  drawRounds,
  isReturnLegGame,
  progressTitle,
  turnOf,
} from '@/components/leagues/leagueDraw'
import { makeGame } from '@/test/factories'
import type { LeagueDrawState } from '@/types/leagueDraw'
import type { GroupTeam } from '@/types/leagueRules'

const team = (id: number): GroupTeam => ({ id, name: `Time ${id}`, nickname: null, logo: null })

function drawState(extra: Partial<LeagueDrawState> = {}): LeagueDrawState {
  return {
    league_id: 1,
    format: 'hybrid',
    fixture_mode: 'draw',
    groups_count: 2,
    group_legs: 2,
    group_size: 5,
    rounds_per_turn: 5,
    total_rounds: 10,
    drawn_rounds: 0,
    next_round: 1,
    can_draw: true,
    draw_blocked_reason: null,
    can_undo: false,
    undo_blocked_reason: 'Nenhuma rodada foi sorteada.',
    can_reset: false,
    reset_blocked_reason: 'Nenhuma rodada foi sorteada.',
    manual_round_games: { total: 0, with_results: 0 },
    groups: [
      { group_number: 1, byes: [] },
      { group_number: 2, byes: [] },
    ],
    ...extra,
  }
}

const ONE_GROUP = drawState({
  format: 'round_robin',
  groups_count: 1,
  group_legs: 1,
  group_size: 4,
  rounds_per_turn: 3,
  total_rounds: 3,
  groups: [{ group_number: 1, byes: [] }],
})

describe('leagueDraw — regras do sorteio', () => {
  it('turno e returno pela rodada e rounds_per_turn', () => {
    const state = drawState()
    expect(turnOf(5, state)).toBe('first')
    expect(turnOf(6, state)).toBe('second')
    expect(turnOf(1, drawState({ group_legs: 1 }))).toBe('single')
  })

  it('jogo do returno só quando é sorteado e passa de rounds_per_turn', () => {
    expect(isReturnLegGame({ round: 6, group_number: 1 }, 5)).toBe(true)
    expect(isReturnLegGame({ round: 5, group_number: 1 }, 5)).toBe(false)
    expect(isReturnLegGame({ round: 6, group_number: null }, 5)).toBe(false)
    expect(isReturnLegGame({ round: 6, group_number: 1 }, null)).toBe(false)
  })

  it('o botão de sortear segue can_draw e next_round', () => {
    expect(canDrawRound(drawState())).toBe(true)
    expect(canDrawRound(ONE_GROUP)).toBe(true)
    expect(canDrawRound(drawState({ can_draw: false, draw_blocked_reason: 'x' }))).toBe(false)
    expect(canDrawRound(drawState({ next_round: null, can_draw: true }))).toBe(false)
  })

  it('confirmação: na 1ª rodada sempre e depois só com partidas manuais', () => {
    expect(drawConfirmation(drawState())).toEqual({
      firstRound: true,
      manualTotal: 0,
      manualWithResults: 0,
      hasReturnLeg: true,
    })
    expect(drawConfirmation(ONE_GROUP)).toEqual({
      firstRound: true,
      manualTotal: 0,
      manualWithResults: 0,
      hasReturnLeg: false,
    })
    expect(drawConfirmation(drawState({ drawn_rounds: 2, next_round: 3 }))).toBeNull()
    expect(
      drawConfirmation(
        drawState({ drawn_rounds: 2, manual_round_games: { total: 3, with_results: 1 } }),
      ),
    ).toMatchObject({ firstRound: false, manualTotal: 3, manualWithResults: 1 })
  })

  it('payload: round sempre e replace_manual_rounds só com partidas manuais', () => {
    expect(drawPayload(1, drawConfirmation(drawState()))).toEqual({ round: 1 })
    expect(drawPayload(4, null)).toEqual({ round: 4 })
    const manual = drawConfirmation(
      drawState({ manual_round_games: { total: 2, with_results: 0 } }),
    )
    expect(drawPayload(1, manual)).toEqual({ round: 1, replace_manual_rounds: true })
  })

  it('monta as rodadas da mais recente para a primeira, com jogos e folga por grupo', () => {
    const state = drawState({
      drawn_rounds: 2,
      next_round: 3,
      groups: [
        {
          group_number: 1,
          byes: [
            { round: 1, team: team(5) },
            { round: 2, team: team(4) },
          ],
        },
        { group_number: 2, byes: [{ round: 2, team: team(10) }] },
      ],
    })
    const games = [
      makeGame(3, { round: 1, group_number: 1 }),
      makeGame(1, { round: 1, group_number: 1 }),
      makeGame(2, { round: 1, group_number: 2 }),
      makeGame(4, { round: 2, group_number: 1 }),
    ]

    const rounds = drawRounds(state, games)

    expect(rounds.map((r) => r.round)).toEqual([2, 1])
    expect(rounds[1].groups[0].games.map((g) => g.id)).toEqual([1, 3])
    expect(rounds[1].groups[0].byes.map((t) => t.id)).toEqual([5])
    expect(rounds[1].groups[1].games.map((g) => g.id)).toEqual([2])
    expect(rounds[0].groups[1].byes.map((t) => t.id)).toEqual([10])
    expect(rounds[0].groups[1].games).toEqual([])
  })

  it('título do progresso', () => {
    expect(progressTitle(0, 10)).toBe('Nenhuma rodada sorteada')
    expect(progressTitle(3, 10)).toBe('Rodada 3 de 10 sorteada')
    expect(progressTitle(1, null)).toBe('1 rodada sorteada')
  })
})
