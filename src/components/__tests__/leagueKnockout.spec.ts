import { describe, expect, it } from 'vitest'
import {
  bracketConfig,
  bracketSections,
  bracketSteps,
  canGenerateStage,
  canUndoStage,
  firstStagePairs,
  generateLabel,
  knockoutConfirmation,
  legScore,
  nextStageLabel,
  nextStagePayload,
  seedOrder,
  tieOutcome,
  undoLabel,
  undoMessage,
  type BracketConfig,
} from '@/components/leagues/leagueKnockout'
import { makeKnockoutState as knockoutState } from '@/test/factories'
import { scoreLabel } from '@/types/game'
import type { KnockoutPhase, KnockoutTie } from '@/types/leagueStats'

function tie(tieKey: string, extra: Partial<KnockoutTie> = {}): KnockoutTie {
  return {
    tie_key: tieKey,
    decided: false,
    winner_team_id: null,
    decided_by: null,
    awaiting_penalties: false,
    decisive_game_id: null,
    home_penalties: null,
    away_penalties: null,
    teams: [
      { team_id: 1, name: 'Vitória FC', nickname: 'Vitória', aggregate_score: 0 },
      { team_id: 2, name: 'Bahia FC', nickname: 'Bahia', aggregate_score: 0 },
    ],
    legs: [
      {
        id: 50,
        leg: null,
        home_team_id: 1,
        away_team_id: 2,
        home_score: null,
        away_score: null,
        status: 'scheduled',
        match_date: null,
      },
    ],
    ...extra,
  }
}

const compact = (pairs: [string, string][]) =>
  pairs.map(([a, b]) => `${a.replace('º Grupo ', '')}x${b.replace('º Grupo ', '')}`)

describe('leagueKnockout — chave igual à do back (KnockoutBracket)', () => {
  it('seedOrder segue a chave padrão', () => {
    expect(seedOrder(2)).toEqual([1, 2])
    expect(seedOrder(4)).toEqual([1, 4, 2, 3])
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(seedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11])
  })

  it.each([
    [2, 1, ['1Ax1B']],
    [2, 2, ['1Ax2B', '1Bx2A']],
    [4, 1, ['1Ax1B', '1Cx1D']],
    [4, 2, ['1Ax2B', '1Cx2D', '1Bx2A', '1Dx2C']],
    [2, 4, ['1Ax4B', '2Bx3A', '1Bx4A', '2Ax3B']],
    [8, 2, ['1Ax2B', '1Cx2D', '1Ex2F', '1Gx2H', '1Bx2A', '1Dx2C', '1Fx2E', '1Hx2G']],
    [4, 4, ['1Ax4B', '1Cx4D', '2Bx3A', '2Dx3C', '1Bx4A', '1Dx4C', '2Ax3B', '2Cx3D']],
    [2, 8, ['1Ax8B', '4Bx5A', '2Bx7A', '3Ax6B', '1Bx8A', '4Ax5B', '2Ax7B', '3Bx6A']],
  ])('%s grupos x %s classificados', (groups, qualifiers, expected) => {
    expect(compact(firstStagePairs(groups, qualifiers))).toEqual(expected)
  })

  it('grupo único usa "Nº colocado"', () => {
    expect(firstStagePairs(1, 4)).toEqual([
      ['1º colocado', '4º colocado'],
      ['2º colocado', '3º colocado'],
    ])
    expect(firstStagePairs(1, 2)).toEqual([['1º colocado', '2º colocado']])
  })

  it('fases começam no tamanho do mata-mata e o 3º lugar vai junto da final', () => {
    expect(bracketSteps(16, true)).toEqual([['R16'], ['QF'], ['SF'], ['F', '3P']])
    expect(bracketSteps(8, false)).toEqual([['QF'], ['SF'], ['F']])
    expect(bracketSteps(4, true)).toEqual([['SF'], ['F', '3P']])
    expect(bracketSteps(2, true)).toEqual([['F']])
  })
})

describe('leagueKnockout — botões e confirmação', () => {
  it('gerar exige enabled, can_generate e próxima fase', () => {
    expect(canGenerateStage(knockoutState())).toBe(true)
    expect(canGenerateStage(knockoutState({ can_generate: false }))).toBe(false)
    expect(canGenerateStage(knockoutState({ enabled: false }))).toBe(false)
    expect(canGenerateStage(knockoutState({ next_stage: null }))).toBe(false)
  })

  it('desfazer exige can_undo e última fase', () => {
    expect(canUndoStage(knockoutState())).toBe(false)
    expect(canUndoStage(knockoutState({ can_undo: true, last_stage: 'QF' }))).toBe(true)
    expect(canUndoStage(knockoutState({ can_undo: false, last_stage: 'QF' }))).toBe(false)
  })

  it('rótulos de gerar e da próxima fase', () => {
    expect(generateLabel(knockoutState())).toBe('Gerar quartas de final')
    expect(nextStageLabel(knockoutState())).toBe('Próxima: Quartas de final · Ida e volta')
    const final = knockoutState({
      next_stage: { key: 'F', label: 'Final', legs: 1, with_third_place: true },
    })
    expect(generateLabel(final)).toBe('Gerar final e 3º lugar')
    expect(nextStageLabel(final)).toBe('Próxima: Final · Jogo único + Disputa de 3º lugar')
    expect(nextStageLabel(knockoutState({ next_stage: null }))).toBeNull()
  })

  it('desfazer a final avisa que a disputa de 3º lugar também sai', () => {
    const semifinal = knockoutState({ last_stage: 'SF', generated_stages: ['QF', 'SF'] })
    expect(undoLabel(semifinal)).toBe('Desfazer semifinal')
    expect(undoMessage(semifinal)).toBe(
      'As partidas das semifinais serão apagadas. Deseja continuar?',
    )

    const final = knockoutState({ last_stage: 'F', generated_stages: ['QF', 'SF', '3P', 'F'] })
    expect(undoLabel(final)).toBe('Desfazer final e 3º lugar')
    expect(undoMessage(final)).toBe(
      'As partidas da final serão apagadas. A disputa de 3º lugar também será desfeita. Deseja continuar?',
    )
    const finalOnly = knockoutState({ last_stage: 'F', generated_stages: ['SF', 'F'] })
    expect(undoLabel(finalOnly)).toBe('Desfazer final')
  })

  it('partidas manuais só contam na 1ª fase e mandam replace_manual_phases', () => {
    const manual = { total: 3, with_results: 1 }
    const first = knockoutConfirmation(knockoutState({ manual_phase_games: manual }))
    expect(first).toEqual({ firstStage: true, manualTotal: 3, manualWithResults: 1 })
    expect(nextStagePayload('QF', first)).toEqual({ stage: 'QF', replace_manual_phases: true })

    const clean = knockoutConfirmation(knockoutState())
    expect(nextStagePayload('QF', clean)).toEqual({ stage: 'QF' })

    const later = knockoutConfirmation(
      knockoutState({ last_stage: 'QF', manual_phase_games: manual }),
    )
    expect(later.manualTotal).toBe(0)
    expect(nextStagePayload('SF', later)).toEqual({ stage: 'SF' })
  })
})

describe('leagueKnockout — resultado do confronto', () => {
  const decisive = {
    id: 51,
    leg: 2 as const,
    home_team_id: 1,
    away_team_id: 2,
    home_score: 1,
    away_score: 1,
    home_penalties: 3,
    away_penalties: 4,
    status: 'finished' as const,
    match_date: null,
  }

  it.each([
    [
      'nos pênaltis, com o placar do vencedor primeiro',
      tie('QF-1', {
        decided: true,
        winner_team_id: 2,
        decided_by: 'penalties',
        decisive_game_id: 51,
        home_penalties: 3,
        away_penalties: 4,
        legs: [decisive],
      }),
      'QF',
      'Classificado: Bahia nos pênaltis (4 × 3)',
    ],
    [
      'pelo gol fora',
      tie('SF-1', { decided: true, winner_team_id: 1, decided_by: 'away_goals' }),
      'SF',
      'Classificado: Vitória pelo gol fora',
    ],
    [
      'pela melhor campanha',
      tie('SF-1', { decided: true, winner_team_id: 1, decided_by: 'better_campaign' }),
      'SF',
      'Classificado: Vitória pela melhor campanha',
    ],
    [
      'no agregado, campeão na final',
      tie('F-1', { decided: true, winner_team_id: 1, decided_by: 'aggregate' }),
      'F',
      'Campeão: Vitória',
    ],
    [
      '3º lugar',
      tie('3P-1', { decided: true, winner_team_id: 2, decided_by: 'aggregate' }),
      '3P',
      '3º lugar: Bahia',
    ],
    [
      'aguardando pênaltis',
      tie('QF-2', { decided: true, winner_team_id: null, awaiting_penalties: true }),
      'QF',
      'Aguardando pênaltis',
    ],
    ['em disputa', tie('QF-3'), 'QF', 'Em disputa'],
    [
      'partida manual empatada',
      tie('SF1', { decided: true, winner_team_id: null }),
      null,
      'Agregado empatado',
    ],
  ] as const)('%s', (_label, data, stage, text) => {
    expect(tieOutcome(data, stage).text).toBe(text)
  })

  it('placar do jogo com pênaltis', () => {
    expect(legScore(decisive)).toBe('1 (3) × (4) 1')
    expect(legScore({ ...decisive, home_penalties: null, away_penalties: null })).toBe('1 × 1')
    expect(legScore({ ...decisive, status: 'scheduled', match_date: '2026-05-10 16:00:00' })).toBe(
      '10/05/2026',
    )
    expect(scoreLabel({ home_score: null, away_score: null })).toBe('—')
  })
})

describe('leagueKnockout — confrontos futuros', () => {
  const config: BracketConfig = { size: 8, groupsCount: 2, qualifiers: 4, thirdPlace: true }
  const titles = (phases: KnockoutPhase[], bracket: BracketConfig | null = config) =>
    bracketSections(phases, bracket).map((section) => section.title)

  it('config só vale em híbrido com sorteio e conta grupos × classificados', () => {
    const league = {
      format: 'hybrid' as const,
      fixture_mode: 'draw' as const,
      groups_count: 2,
      qualifiers_per_group: 4,
      knockout_size: 8 as const,
      third_place: true,
    }
    expect(bracketConfig(league)).toEqual(config)
    expect(bracketConfig({ ...league, fixture_mode: 'manual' })).toBeNull()
    expect(bracketConfig({ ...league, format: 'knockout' })).toBeNull()
    expect(bracketConfig({ ...league, qualifiers_per_group: 2 })).toBeNull()
    expect(bracketConfig({ ...league, knockout_size: null })).toBeNull()
    expect(bracketConfig({ ...league, groups_count: 3, qualifiers_per_group: null })).toBeNull()
    expect(bracketConfig(null)).toBeNull()
  })

  it('nada gerado: chave inteira projetada, 3º lugar antes da final', () => {
    const sections = bracketSections([], config)

    expect(sections.map((section) => section.title)).toEqual([
      'Quartas de final',
      'Semifinal',
      'Disputa de 3º lugar',
      'Final',
    ])
    expect(sections[0].future.map((item) => `${item.home} x ${item.away}`)).toEqual([
      '1º Grupo A x 4º Grupo B',
      '2º Grupo B x 3º Grupo A',
      '1º Grupo B x 4º Grupo A',
      '2º Grupo A x 3º Grupo B',
    ])
    expect(sections[1].future).toEqual([
      { tie_key: 'SF-1', home: 'Vencedor QF-1', away: 'Vencedor QF-2' },
      { tie_key: 'SF-2', home: 'Vencedor QF-3', away: 'Vencedor QF-4' },
    ])
    expect(sections[2].future).toEqual([
      { tie_key: '3P-1', home: 'Perdedor SF-1', away: 'Perdedor SF-2' },
    ])
    expect(sections[3].future).toEqual([
      { tie_key: 'F-1', home: 'Vencedor SF-1', away: 'Vencedor SF-2' },
    ])
  })

  it('fase gerada usa o nome do vencedor já decidido na próxima', () => {
    const quarter: KnockoutPhase = {
      phase: 'Quartas de final',
      phase_order: 2,
      stage: 'QF',
      ties: [
        tie('QF-1', { decided: true, winner_team_id: 2, decided_by: 'aggregate' }),
        tie('QF-2'),
        tie('QF-3'),
        tie('QF-4'),
      ],
    }
    const sections = bracketSections([quarter], config)

    expect(sections.map((section) => section.title)).toEqual([
      'Quartas de final',
      'Semifinal',
      'Disputa de 3º lugar',
      'Final',
    ])
    expect(sections[0].ties).toHaveLength(4)
    expect(sections[0].future).toEqual([])
    expect(sections[1].future[0]).toEqual({
      tie_key: 'SF-1',
      home: 'Bahia',
      away: 'Vencedor QF-2',
    })
  })

  it('3º lugar mostra o perdedor da semifinal decidida', () => {
    const semi: KnockoutPhase = {
      phase: 'Semifinal',
      phase_order: 3,
      stage: 'SF',
      ties: [
        tie('SF-1', { decided: true, winner_team_id: 1, decided_by: 'aggregate' }),
        tie('SF-2'),
      ],
    }
    const sections = bracketSections([semi], { ...config, size: 4, qualifiers: 2 })

    expect(sections.map((section) => section.title)).toEqual([
      'Semifinal',
      'Disputa de 3º lugar',
      'Final',
    ])
    expect(sections[1].future).toEqual([{ tie_key: '3P-1', home: 'Bahia', away: 'Perdedor SF-2' }])
    expect(sections[2].future).toEqual([{ tie_key: 'F-1', home: 'Vitória', away: 'Vencedor SF-2' }])
  })

  it('sem config ou com fase manual na liga, só as fases que existem', () => {
    const manual: KnockoutPhase = { phase: 'Final', phase_order: 1, stage: null, ties: [tie('F')] }
    expect(titles([manual])).toEqual(['Final'])
    expect(titles([], null)).toEqual([])
  })

  it('liga de 1 grupo e mata-mata de 2: só a final entre 1º e 2º', () => {
    const sections = bracketSections([], {
      size: 2,
      groupsCount: 1,
      qualifiers: 2,
      thirdPlace: true,
    })
    expect(sections).toHaveLength(1)
    expect(sections[0].future).toEqual([
      { tie_key: 'F-1', home: '1º colocado', away: '2º colocado' },
    ])
  })
})
