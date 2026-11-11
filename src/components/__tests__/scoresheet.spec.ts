import { describe, expect, it } from 'vitest'
import {
  buildScoresheet,
  eventSheet,
  eventSheetsCount,
  eventTypeAbbreviation,
  generatedAt,
  maskCpf,
  printsPenaltiesSheet,
  rosterSheet,
  rostersAboveLimit,
  rosterSheetsCount,
  scoresheetEvents,
  scoresheetRosterRows,
  scoresheetEventTypes,
  scoresheetFilled,
  scoresheetShootout,
  sheetDate,
  sortRoster,
  stageDescription,
  teamInitials,
} from '@/components/games/scoresheet/scoresheet'
import {
  defaultEventTypes,
  makeEvent,
  makeEventType,
  makeGame,
  makeMember,
  makePlayer,
  makeTeam,
} from '@/test/factories'
import type { Game, GamePenaltyKick, GameStatus } from '@/types/game'

const players = (count: number) =>
  Array.from({ length: count }, (_, index) => makePlayer(index + 1, `Atleta ${index + 1}`))

const kick = (
  order: number,
  teamId: number,
  scored: boolean,
  player: GamePenaltyKick['player'] = {
    id: order,
    name: 'Cobrador',
    number: order,
    removed: false,
  },
): GamePenaltyKick => ({
  id: order,
  order,
  team_id: teamId,
  player_id: order,
  scored,
  player,
})

const alternatingKicks = (perTeam: number) =>
  Array.from({ length: perTeam * 2 }, (_, index) =>
    kick(index + 1, index % 2 === 0 ? 1 : 2, index % 2 === 0),
  )

describe('scoresheet helpers', () => {
  it.each([
    ['52998224725', '***.982.247-**'],
    ['529.982.247-25', '***.982.247-**'],
    ['5299822', ''],
    [null, ''],
  ])('maskCpf(%s) = %s', (value, expected) => {
    expect(maskCpf(value)).toBe(expected)
  })

  it('sigla do tipo vem da API e cai nas iniciais do nome quando é nula', () => {
    expect(eventTypeAbbreviation({ name: 'Cartão amarelo', abbreviation: 'ca' })).toBe('CA')
    expect(eventTypeAbbreviation({ name: 'Cartão amarelo', abbreviation: null })).toBe('CA')
    expect(eventTypeAbbreviation({ name: 'Gol contra', abbreviation: '  ' })).toBe('GC')
    expect(eventTypeAbbreviation({ name: 'Gol' })).toBe('G')
    expect(eventTypeAbbreviation({ name: 'Expulsão de atleta do banco' })).toBe('EAB')
  })

  it('iniciais do time ignoram conectivos', () => {
    expect(teamInitials(makeTeam(1, 'Leões do Jardim FC'))).toBe('LJ')
    expect(teamInitials(undefined)).toBe('')
  })

  it('elenco ordenado pelo número, sem número no fim e empate pelo nome', () => {
    const roster = sortRoster([
      makePlayer(1, 'Zé', { number: null }),
      makePlayer(2, 'Bruno', { number: 10 }),
      makePlayer(3, 'Ana', { number: null }),
      makePlayer(4, 'Caio', { number: 2 }),
    ])
    expect(roster.map((player) => player.name)).toEqual(['Caio', 'Bruno', 'Ana', 'Zé'])
  })

  it.each([
    [0, 0, 1],
    [14, 10, 1],
    [15, 3, 1],
    [17, 17, 1],
    [35, 35, 1],
    [36, 3, 2],
    [10, 71, 3],
    [70, 0, 2],
    [71, 0, 3],
  ])('mandante %i e visitante %i atletas ocupam %i folha(s) de relação', (home, away, sheets) => {
    expect(rosterSheetsCount(35, players(home), players(away))).toBe(sheets)
  })

  it.each([
    [14, 21],
    [34, 1],
    [35, 0],
  ])('elenco de %i atletas fica numa folha só, com %i linha(s) em branco', (size, blank) => {
    const roster = players(size)
    const sheet = rosterSheet(roster, 0, 35)
    expect(sheet).toHaveLength(35)
    expect(sheet.slice(0, size)).toEqual(roster)
    expect(sheet.filter((row) => row === null)).toHaveLength(blank)
    expect(rosterSheetsCount(35, roster, [])).toBe(1)
  })

  it('cada folha da relação tem 35 linhas, completando com linhas em branco', () => {
    const roster = players(38)
    expect(rosterSheet(roster, 0, 35)).toEqual(roster.slice(0, 35))
    const second = rosterSheet(roster, 1, 35)
    expect(second).toHaveLength(35)
    expect(second.slice(0, 3)).toEqual(roster.slice(35))
    expect(second.slice(3).every((row) => row === null)).toBe(true)
  })

  it.each<[number | null | undefined, number]>([
    [undefined, 35],
    [null, 35],
    [35, 35],
    [30, 30],
    [20, 20],
    [11, 11],
    [10, 35],
    [36, 35],
    [0, 35],
    [-5, 35],
    [20.5, 35],
    [Number.NaN, 35],
    ['30' as unknown as number, 35],
  ])('limite da liga %s gera %i linhas', (limit, rows) => {
    expect(scoresheetRosterRows(limit)).toBe(rows)
  })

  it.each([
    [20, 20, 0, 1],
    [20, 21, 0, 2],
    [20, 40, 39, 2],
    [20, 3, 41, 3],
    [11, 12, 0, 2],
    [25, 25, 25, 1],
  ])('com %i linhas, elencos de %i e %i ocupam %i folha(s)', (rows, home, away, sheets) => {
    expect(rosterSheetsCount(rows, players(home), players(away))).toBe(sheets)
  })

  it('linhas por folha seguem o limite e o excedente vai para a continuação', () => {
    const roster = players(23)
    const first = rosterSheet(roster, 0, 20)
    expect(first).toEqual(roster.slice(0, 20))
    const second = rosterSheet(roster, 1, 20)
    expect(second).toHaveLength(20)
    expect(second.slice(0, 3)).toEqual(roster.slice(20))
    expect(second.slice(3).every((row) => row === null)).toBe(true)
  })

  it('data com dia da semana e hora', () => {
    expect(sheetDate('2026-11-21 15:30:00')).toBe('Sáb, 21/11/2026 · 15:30')
    expect(sheetDate('2026-11-21T15:30:00', ', ')).toBe('Sáb, 21/11/2026, 15:30')
    expect(sheetDate('2026-11-22')).toBe('Dom, 22/11/2026')
    expect(sheetDate(null)).toBeNull()
  })

  it('data de geração e fase/rodada', () => {
    expect(generatedAt(new Date(2026, 10, 6, 8, 5))).toBe('06/11/2026 às 08:05')
    expect(stageDescription({ round: 3, phase: null, leg: null })).toBe('3ª rodada')
    expect(stageDescription({ round: null, phase: 'Quartas de final', leg: null })).toBe(
      'Quartas de final · Jogo único',
    )
    expect(stageDescription({ round: null, phase: 'Semifinal', leg: 2 })).toBe('Semifinal · Volta')
    expect(stageDescription({ round: null, phase: null, leg: null })).toBe('')
  })
})

describe('buildScoresheet', () => {
  const home = makeTeam(1, 'Leões do Jardim FC', {
    players: [makePlayer(2, 'Bruno', { number: 9 }), makePlayer(1, 'Ana', { number: 1 })],
    technicalCommitteeMembers: [makeMember(5, 'Marcos Vieira'), makeMember(6, 'Outro Treinador')],
  })
  const away = makeTeam(2, 'Unidos da Vila Nova', { players: [], technicalCommitteeMembers: [] })

  it('usa a liga do jogo, o primeiro treinador e o elenco ordenado', () => {
    const data = buildScoresheet(
      makeGame(142, {
        homeTeam: home,
        awayTeam: away,
        match_date: '2026-11-21 15:30:00',
        stadium: {
          id: 1,
          league_id: 1,
          name: 'Campo Sul',
          city: 'Campinas',
          capacity: 500,
          created_at: '',
          updated_at: '',
        },
        league: { id: 1, name: 'Série Ouro', championship: { id: 1, name: 'Copa Leste' } },
      }),
      { championship: 'Outro', league: 'Outra' },
    )

    expect(data.code).toBe('#0142')
    expect(data.competition).toEqual(['Copa Leste', 'Série Ouro'])
    expect(data.home.coach).toBe('Marcos Vieira')
    expect(data.away.coach).toBeNull()
    expect(data.home.roster.map((player) => player.name)).toEqual(['Ana', 'Bruno'])
    expect(data.stageLabel).toBe('Rodada')
    expect(data.stage).toBe('1ª rodada')
    expect(data.place).toBe('Campo Sul · Campinas')
    expect(data.date).toBe('Sáb, 21/11/2026 · 15:30')
    expect(data.matchline).toBe('Sáb, 21/11/2026, 15:30 · Campo Sul · Campinas')
    expect(data.penalties).toBe(false)
    expect(data.rosterSheets).toBe(1)
  })

  it('sem liga no payload usa o contexto; grupo só com mais de um grupo; pênaltis por penalties_possible', () => {
    const game = makeGame(7, {
      homeTeam: home,
      awayTeam: away,
      group_number: 2,
      round: null,
      phase: 'Final',
      penalties_possible: true,
    })

    const data = buildScoresheet(game, { championship: 'Copa', league: 'Série B', groupsCount: 2 })
    expect(data.competition).toEqual(['Copa', 'Série B'])
    expect(data.stageLabel).toBe('Fase')
    expect(data.stage).toBe('Grupo B · Final · Jogo único')
    expect(data.penalties).toBe(true)
    expect(data.date).toBeNull()
    expect(data.place).toBeNull()
    expect(data.matchline).toBe('')

    expect(buildScoresheet(game, { groupsCount: 1 }).stage).toBe('Final · Jogo único')
  })
})

describe('limite de jogadores na súmula', () => {
  const league = (limit?: number | null) => ({
    id: 1,
    name: 'Série A',
    championship: null,
    max_players_per_team: limit,
  })
  const withRosters = (
    home: number,
    away: number,
    limit?: number | null,
    status: GameStatus = 'scheduled',
  ) =>
    makeGame(1, {
      status,
      league: league(limit),
      homeTeam: makeTeam(1, 'Casa', { players: players(home) }),
      awayTeam: makeTeam(2, 'Fora', { players: players(away) }),
    })

  it.each<GameStatus>(['scheduled', 'finished'])('linhas seguem a liga em partida %s', (status) => {
    const data = buildScoresheet(withRosters(5, 5, 25, status))
    expect(data.rosterRows).toBe(25)
    expect(data.rosterSheets).toBe(1)
  })

  it('sem a liga no payload ou sem o campo ficam 35 linhas', () => {
    expect(buildScoresheet(makeGame(1)).rosterRows).toBe(35)
    expect(buildScoresheet(withRosters(5, 5)).rosterRows).toBe(35)
  })

  it('em branco também respeita o limite, numa partida finalizada', () => {
    const data = buildScoresheet(withRosters(5, 5, 20, 'finished'), {}, true)
    expect(data.filled).toBe(false)
    expect(data.rosterRows).toBe(20)
  })

  it('elenco acima do limite ganha continuação e é apontado, sem cortar atletas', () => {
    const data = buildScoresheet(withRosters(23, 5, 20))
    expect(data.rosterSheets).toBe(2)
    expect(data.penaltiesPage).toBe(4)
    expect(data.home.roster).toHaveLength(23)
    expect(rostersAboveLimit(data)).toEqual([{ name: 'Casa', players: 23 }])
    expect(rostersAboveLimit(buildScoresheet(withRosters(20, 20, 20)))).toEqual([])
    expect(rostersAboveLimit(buildScoresheet(withRosters(21, 22, 20)))).toEqual([
      { name: 'Casa', players: 21 },
      { name: 'Fora', players: 22 },
    ])
  })
})

describe('súmula preenchida', () => {
  const ALL_STATUSES: GameStatus[] = ['scheduled', 'in_progress', 'finished', 'cancelled']

  it.each(ALL_STATUSES)('status %s define se a súmula sai preenchida', (status) => {
    expect(scoresheetFilled({ status })).toBe(status === 'finished')
    expect(scoresheetFilled({ status }, true)).toBe(false)
  })

  const SCORE = { home_penalties: 4, away_penalties: 3 }
  const KICKS = { penaltyKicks: [kick(1, 1, true)] }

  it.each<[string, Partial<Game>, boolean, boolean]>([
    ['agendada, não decisiva', { status: 'scheduled', penalties_possible: false }, false, false],
    ['agendada, decisiva', { status: 'scheduled', penalties_possible: true }, false, true],
    ['em andamento, decisiva', { status: 'in_progress', penalties_possible: true }, false, true],
    ['cancelada, decisiva', { status: 'cancelled', penalties_possible: true }, false, true],
    ['agendada, com cobranças', { status: 'scheduled', ...KICKS }, false, false],
    ['preenchida, com cobranças', { status: 'finished', ...KICKS }, true, true],
    [
      'preenchida, decisiva e sem pênaltis',
      { status: 'finished', penalties_possible: true },
      true,
      false,
    ],
    [
      'preenchida, só com placar de pênaltis',
      { status: 'finished', penalties_possible: true, ...SCORE },
      true,
      false,
    ],
    [
      'em branco, decisiva e com cobranças',
      { status: 'finished', penalties_possible: true, ...KICKS },
      false,
      true,
    ],
    [
      'em branco, decisiva e só com placar de pênaltis',
      { status: 'finished', penalties_possible: true, ...SCORE },
      false,
      true,
    ],
    [
      'em branco, decisiva e sem pênaltis',
      { status: 'finished', penalties_possible: true },
      false,
      false,
    ],
    ['em branco, não decisiva', { status: 'finished', penalties_possible: false }, false, false],
    ['pontos corridos preenchida', { status: 'finished', round: 3 }, true, false],
    ['pontos corridos em branco', { status: 'finished', round: 3 }, false, false],
  ])('folha de pênaltis: %s', (_label, extra, filled, expected) => {
    expect(printsPenaltiesSheet(makeGame(1, { round: null, ...extra }), filled)).toBe(expected)
  })

  it('eventos em minuto crescente, sem minuto no fim e empate pelo id', () => {
    const events = scoresheetEvents(
      makeGame(1, {
        events: [
          makeEvent(5, { minute: null }),
          makeEvent(4, { minute: 80 }),
          makeEvent(3, { minute: null }),
          makeEvent(7, { minute: 10 }),
          makeEvent(2, { minute: 10 }),
          makeEvent(6, { minute: 0 }),
        ],
      }),
    )
    expect(events.map((event) => [event.id, event.minute])).toEqual([
      [6, 0],
      [2, 10],
      [7, 10],
      [4, 80],
      [3, null],
      [5, null],
    ])
  })

  it('evento vem com time, número, assistência e continua legível sem número', () => {
    const [goal, ownGoal, noNumber] = scoresheetEvents(
      makeGame(1, {
        events: [
          makeEvent(1, {
            minute: 1,
            team_id: 1,
            player: { id: 9, name: 'Fulano', number: 9, removed: false },
            related_player_id: 7,
            related_player: { id: 7, name: 'Sicrano', number: 7, removed: false },
          }),
          makeEvent(2, {
            minute: 2,
            team_id: 2,
            type: 'own_goal',
            player: { id: 4, name: 'Beltrano', number: 4, removed: false },
          }),
          makeEvent(3, {
            minute: 3,
            team_id: 1,
            player: { id: 5, name: 'Sem Número', removed: false },
            related_player: { id: 6, name: 'Passador', number: null, removed: true },
          }),
        ],
      }),
    )

    expect(goal).toMatchObject({
      side: 'home',
      number: 9,
      athlete: 'Fulano',
      assistNumber: 7,
      observation: 'Assist.: Sicrano',
    })
    expect(ownGoal).toMatchObject({
      side: 'away',
      type: 'own_goal',
      assistNumber: null,
      observation: '',
    })
    expect(noNumber).toMatchObject({
      number: null,
      athlete: 'Sem Número',
      assistNumber: null,
      observation: 'Assist.: Passador',
    })
  })

  it.each([
    [0, 1],
    [1, 1],
    [18, 1],
    [19, 2],
    [36, 2],
    [37, 3],
  ])('%i eventos ocupam %i folha(s)', (count, sheets) => {
    expect(eventSheetsCount(Array.from({ length: count }))).toBe(sheets)
  })

  it('folha de continuação segue a numeração e completa com linhas vazias', () => {
    const events = scoresheetEvents(
      makeGame(1, {
        events: Array.from({ length: 20 }, (_, index) =>
          makeEvent(index + 1, { minute: index + 1 }),
        ),
      }),
    )

    const first = eventSheet(events, 0)
    expect(first).toHaveLength(18)
    expect(first[17]).toMatchObject({ index: 18, event: { id: 18 } })
    const second = eventSheet(events, 1)
    expect(second).toHaveLength(18)
    expect(second.slice(0, 2)).toMatchObject([
      { index: 19, event: { id: 19 } },
      { index: 20, event: { id: 20 } },
    ])
    expect(second[2]).toEqual({ index: 21, event: null })
    expect(second[17]).toEqual({ index: 36, event: null })
  })

  it('tipos: ativos mais os usados na partida, sem repetir', () => {
    const active = defaultEventTypes()
    const legacy = makeEventType(9, 'legacy', { name: 'Tipo antigo', active: false })
    const bySlug = (slug: string) =>
      slug === 'legacy' ? legacy : makeEventType(0, slug, { active: false })

    expect(scoresheetEventTypes(active, [], bySlug)).toEqual(active)
    expect(scoresheetEventTypes(active, [{ type: 'goal' }], bySlug)).toEqual(active)
    const merged = scoresheetEventTypes(
      active,
      [{ type: 'legacy' }, { type: 'legacy' }, { type: 'sumiu' }],
      bySlug,
    )
    expect(merged.slice(active.length).map((type) => type.slug)).toEqual(['legacy', 'sumiu'])
  })

  it('cobranças por time na ordem, quem bateu primeiro, total e vencedor', () => {
    const shootout = scoresheetShootout(
      makeGame(1, {
        penaltyKicks: [
          kick(1, 2, true, { id: 1, name: 'Fulano', number: 9, removed: false }),
          kick(2, 1, false, { id: 2, name: 'Sicrano', number: 7, removed: false }),
          kick(3, 2, true, { id: 3, name: 'João da Silva', number: null, removed: false }),
          kick(4, 1, true, null),
          kick(5, 2, true, { id: 5, name: 'Beltrano', number: 11, removed: false }),
          kick(6, 1, false, { id: 6, name: 'Outro', number: 3, removed: true }),
          kick(7, 2, false, { id: 7, name: 'Quarto', number: 4, removed: false }),
          kick(8, 1, false, { id: 8, name: 'Oitavo', number: 8, removed: false }),
        ],
      }),
      true,
    )

    expect(shootout.columns).toBe(12)
    expect(shootout.away).toMatchObject({ first: true, goals: '3', won: true })
    expect(shootout.home).toMatchObject({ first: false, goals: '1', won: false })
    expect(shootout.away.kicks).toEqual([
      { label: '9', scored: true },
      { label: 'JS', scored: true },
      { label: '11', scored: true },
      { label: '4', scored: false },
    ])
    expect(shootout.home.kicks.map((item) => item.label)).toEqual(['7', '', '3', '8'])
  })

  it.each([
    [12, 12],
    [13, 13],
    [30, 30],
  ])('%i cobranças por time ocupam %i colunas', (perTeam, columns) => {
    const shootout = scoresheetShootout(
      makeGame(1, { penaltyKicks: alternatingKicks(perTeam) }),
      true,
    )
    expect(shootout.columns).toBe(columns)
    expect(shootout.home.kicks).toHaveLength(perTeam)
    expect(shootout.away.kicks).toHaveLength(perTeam)
  })

  it('em branco a grade ignora as cobranças gravadas', () => {
    const shootout = scoresheetShootout(makeGame(1, { penaltyKicks: alternatingKicks(15) }), false)
    expect(shootout.columns).toBe(12)
    expect(shootout.home).toEqual({ first: false, goals: '', won: false, kicks: [] })
    expect(shootout.away).toEqual({ first: false, goals: '', won: false, kicks: [] })
  })

  const finished = makeGame(1, {
    status: 'finished',
    home_score: 2,
    away_score: 0,
    round: null,
    phase: 'Final',
    penalties_possible: true,
    home_penalties: 4,
    away_penalties: 3,
    penaltyKicks: alternatingKicks(5),
    events: Array.from({ length: 19 }, (_, index) => makeEvent(index + 1, { minute: index })),
    homeTeam: makeTeam(1, 'Casa', { players: [] }),
    awayTeam: makeTeam(2, 'Fora', { players: [] }),
  })

  it('finalizada traz placar, eventos e numeração das folhas', () => {
    const data = buildScoresheet(finished)

    expect(data.filled).toBe(true)
    expect([data.home.score, data.away.score]).toEqual(['2', '0'])
    expect(data.penaltiesScore).toBe('4 × 3')
    expect(data.events).toHaveLength(19)
    expect(data.eventSheets).toBe(2)
    expect(data.penalties).toBe(true)
    expect(data.penaltiesPage).toBe(4)
  })

  it('placar zerado continua impresso em partida finalizada', () => {
    const data = buildScoresheet({ ...finished, home_score: 0, away_score: 0 })
    expect([data.home.score, data.away.score]).toEqual(['0', '0'])
  })

  it('finalizada em branco não leva nenhum dado do jogo', () => {
    const data = buildScoresheet(finished, {}, true)

    expect(data.filled).toBe(false)
    expect([data.home.score, data.away.score]).toEqual(['', ''])
    expect(data.penaltiesScore).toBeNull()
    expect(data.events).toEqual([])
    expect(data.eventSheets).toBe(1)
    expect(data.penalties).toBe(true)
    expect(data.penaltiesPage).toBe(3)
  })

  it.each<GameStatus>(['scheduled', 'in_progress', 'cancelled'])(
    '%s com eventos lançados continua em branco',
    (status) => {
      const data = buildScoresheet({ ...finished, status })

      expect(data.filled).toBe(false)
      expect(data.home.score).toBe('')
      expect(data.events).toEqual([])
      expect(data.shootout.home.kicks).toEqual([])
    },
  )
})
