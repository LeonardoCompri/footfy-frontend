import { describe, expect, it } from 'vitest'
import {
  buildScoresheet,
  eventTypeAbbreviation,
  generatedAt,
  maskCpf,
  rosterSheet,
  rosterSheetsCount,
  sheetDate,
  sortRoster,
  stageDescription,
  teamInitials,
} from '@/components/games/scoresheet/scoresheet'
import { makeGame, makeMember, makePlayer, makeTeam } from '@/test/factories'

const players = (count: number) =>
  Array.from({ length: count }, (_, index) => makePlayer(index + 1, `Atleta ${index + 1}`))

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
    [18, 3, 2],
    [10, 31, 2],
    [34, 0, 2],
    [35, 0, 3],
  ])('mandante %i e visitante %i atletas ocupam %i folha(s) de relação', (home, away, sheets) => {
    expect(rosterSheetsCount(players(home), players(away))).toBe(sheets)
  })

  it.each([
    [14, 3],
    [15, 2],
    [17, 0],
  ])('elenco de %i atletas fica numa folha só, com %i linha(s) em branco', (size, blank) => {
    const roster = players(size)
    const sheet = rosterSheet(roster, 0)
    expect(sheet).toHaveLength(17)
    expect(sheet.slice(0, size)).toEqual(roster)
    expect(sheet.filter((row) => row === null)).toHaveLength(blank)
    expect(rosterSheetsCount(roster, [])).toBe(1)
  })

  it('cada folha da relação tem 17 linhas, completando com linhas em branco', () => {
    const roster = players(20)
    expect(rosterSheet(roster, 0)).toEqual(roster.slice(0, 17))
    const second = rosterSheet(roster, 1)
    expect(second).toHaveLength(17)
    expect(second.slice(0, 3)).toEqual(roster.slice(17))
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
