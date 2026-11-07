import { describe, expect, it } from 'vitest'
import {
  canAddKick,
  draftResult,
  hasShootout,
  kickTeamId,
  MAX_KICKS,
  outOfTurn,
  repeatedKickers,
  resolveShootout,
  SHOOTOUT_EMPTY,
  SHOOTOUT_MAX,
  SHOOTOUT_UNFINISHED,
  shootoutColumns,
  shootoutDecidedAt,
  shootoutDraftIssue,
  shootoutIncomplete,
  showsShootoutEditor,
  type ShootoutDraftKick,
} from '@/components/games/shootout'
import { makeGame } from '@/test/factories'

const HOME = 10
const AWAY = 20

function kicks(first: string, second: string, homeFirst = true) {
  const teams = homeFirst ? [HOME, AWAY] : [AWAY, HOME]
  const result: { team_id: number; scored: boolean }[] = []
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    ;[first, second].forEach((pattern, side) => {
      if (i < pattern.length) result.push({ team_id: teams[side], scored: pattern[i] === 'G' })
    })
  }
  return result
}

function draft(first: string, second: string, homeFirst = true): ShootoutDraftKick[] {
  return kicks(first, second, homeFirst).map((kick, index) => ({ ...kick, player_id: index + 1 }))
}

describe('resolveShootout', () => {
  it.each([
    ['decidida nas cinco, antes do fim', 'GGG', 'XXX', true, true, 3, 0, HOME, 6],
    ['decidida na cobrança de quem bateu primeiro', 'GGGG', 'XXG', false, true, 1, 4, AWAY, 7],
    ['decidida na última das cinco', 'GGGGX', 'GGGXX', true, true, 4, 3, HOME, 10],
    ['morte súbita no primeiro par', 'GGGGGG', 'GGGGGX', true, true, 6, 5, HOME, 12],
    ['morte súbita depois de pares convertidos', 'GGGGGGX', 'GGGGGGG', true, true, 6, 7, AWAY, 14],
    ['morte súbita perdendo os dois', 'GGGGGXG', 'GGGGGXX', true, true, 6, 5, HOME, 14],
    ['inacabada nas cinco', 'GGG', 'GG', true, false, 3, 2, null, null],
    ['empatada nas cinco', 'GGGGG', 'GGGGG', true, false, 5, 5, null, null],
    ['morte súbita esperando a resposta', 'GGGGGG', 'GGGGG', true, false, 6, 5, null, null],
    ['cobrança depois da decisão', 'GGGX', 'XXX', true, true, 3, 0, HOME, 6],
    ['sem cobranças', '', '', true, false, 0, 0, null, null],
  ] as const)('%s', (_label, first, second, homeFirst, finished, home, away, winner, decidedAt) => {
    expect(resolveShootout(kicks(first, second, homeFirst), HOME, AWAY)).toEqual({
      finished,
      home,
      away,
      winner,
      decided_at: decidedAt,
    })
  })

  it('ignora cobranças de outros times', () => {
    const list = [...kicks('GGG', 'XXX'), { team_id: 99, scored: true }]

    expect(resolveShootout(list, HOME, AWAY)).toEqual({
      finished: true,
      home: 3,
      away: 0,
      winner: HOME,
      decided_at: 6,
    })
  })
})

describe('outOfTurn', () => {
  const kick = (team_id: number) => ({ team_id })

  it('devolve a ordem da primeira cobrança que quebra a alternância', () => {
    expect(outOfTurn([])).toBeNull()
    expect(outOfTurn([kick(AWAY)])).toBeNull()
    expect(outOfTurn([kick(AWAY), kick(HOME), kick(AWAY)])).toBeNull()
    expect(outOfTurn([kick(HOME), kick(HOME)])).toBe(2)
    expect(outOfTurn([kick(HOME), kick(AWAY), kick(HOME), kick(HOME)])).toBe(4)
  })
})

describe('kickTeamId', () => {
  it('alterna a partir do time que bateu primeiro', () => {
    expect([0, 1, 2, 3].map((index) => kickTeamId(index, AWAY, HOME, AWAY))).toEqual([
      AWAY,
      HOME,
      AWAY,
      HOME,
    ])
    expect([0, 1].map((index) => kickTeamId(index, HOME, HOME, AWAY))).toEqual([HOME, AWAY])
  })
})

describe('rascunho da disputa', () => {
  it('placar ao vivo considera só as cobranças com resultado até a primeira pendente', () => {
    const rows = draft('GG', 'X')
    rows.push({ team_id: AWAY, player_id: null, scored: null })

    expect(draftResult(rows, HOME, AWAY)).toMatchObject({ home: 2, away: 0, finished: false })
  })

  it.each([
    ['sem cobranças', [] as ShootoutDraftKick[], SHOOTOUT_EMPTY],
    ['inacabada', draft('GGG', 'GG'), SHOOTOUT_UNFINISHED],
    ['decidida', draft('GGG', 'XXX'), null],
    ['cobrança depois da decisão', draft('GGGX', 'XXX'), shootoutDecidedAt(6)],
    [
      'sem cobrador',
      draft('GGG', 'XXX').map((row, index) => (index === 2 ? { ...row, player_id: null } : row)),
      shootoutIncomplete(3),
    ],
    [
      'sem resultado',
      [...draft('GG', 'X'), { team_id: AWAY, player_id: 9, scored: null }],
      shootoutIncomplete(4),
    ],
  ])('%s', (_label, rows, issue) => {
    expect(shootoutDraftIssue(rows, HOME, AWAY)).toBe(issue)
  })

  it(`mais de ${MAX_KICKS} cobranças`, () => {
    const rows = Array.from({ length: MAX_KICKS + 1 }, (_, index) => ({
      team_id: index % 2 ? AWAY : HOME,
      player_id: index + 1,
      scored: true,
    }))

    expect(shootoutDraftIssue(rows, HOME, AWAY)).toBe(SHOOTOUT_MAX)
  })

  it('nova cobrança só depois da anterior completa e antes do fim', () => {
    expect(canAddKick([], HOME, AWAY)).toBe(true)
    expect(canAddKick(draft('GG', 'G'), HOME, AWAY)).toBe(true)
    expect(canAddKick([{ team_id: HOME, player_id: 1, scored: null }], HOME, AWAY)).toBe(false)
    expect(canAddKick([{ team_id: HOME, player_id: null, scored: true }], HOME, AWAY)).toBe(false)
    expect(canAddKick(draft('GGG', 'XXX'), HOME, AWAY)).toBe(false)
  })
})

describe('repeatedKickers', () => {
  it('avisa quando o cobrador repete antes de todos do time baterem', () => {
    const rows = [
      { team_id: HOME, player_id: 1 },
      { team_id: AWAY, player_id: 5 },
      { team_id: HOME, player_id: 1 },
      { team_id: AWAY, player_id: 6 },
      { team_id: HOME, player_id: 2 },
      { team_id: AWAY, player_id: 5 },
    ]

    expect([...repeatedKickers(rows, () => 3)]).toEqual([
      [2, 1],
      [5, 2],
    ])
  })

  it('libera a repetição depois que todo o elenco bateu', () => {
    const rows = [
      { team_id: HOME, player_id: 1 },
      { team_id: HOME, player_id: 2 },
      { team_id: HOME, player_id: 1 },
      { team_id: HOME, player_id: 1 },
    ]

    expect([...repeatedKickers(rows, () => 2)]).toEqual([[3, 3]])
  })

  it('ignora linhas sem cobrador', () => {
    const rows = [
      { team_id: HOME, player_id: null },
      { team_id: HOME, player_id: null },
    ]

    expect(repeatedKickers(rows, () => 5).size).toBe(0)
  })
})

describe('shootoutColumns', () => {
  it('mostra sempre as 5 regulamentares e cresce com as alternadas', () => {
    expect(shootoutColumns([], HOME, AWAY)).toBe(5)
    expect(shootoutColumns(kicks('GGG', 'XXX'), HOME, AWAY)).toBe(5)
    expect(shootoutColumns(kicks('GGGGGGG', 'GGGGGGX'), HOME, AWAY)).toBe(7)
  })
})

describe('quando mostrar', () => {
  const kick = { id: 1, order: 1, team_id: 1, player_id: 3, scored: true }

  it.each([
    ['permitido sem cobranças', { penalties_allowed: true }, true],
    ['não permitido sem cobranças', { penalties_allowed: false }, false],
    ['não permitido com cobranças', { penalties_allowed: false, penaltyKicks: [kick] }, true],
    ['jogo antigo só com o placar', { home_penalties: 4, away_penalties: 3 }, false],
  ])('tela de digitação: %s', (_label, extra, expected) => {
    expect(showsShootoutEditor(makeGame(1, extra))).toBe(expected)
  })

  it.each([
    ['sem nada', {}, false],
    ['com cobranças', { penaltyKicks: [kick] }, true],
    ['jogo antigo só com o placar', { home_penalties: 4, away_penalties: 3 }, true],
  ])('grade: %s', (_label, extra, expected) => {
    expect(hasShootout(makeGame(1, extra))).toBe(expected)
  })
})
