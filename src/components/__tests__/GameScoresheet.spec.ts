import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GameScoresheet from '@/components/games/scoresheet/GameScoresheet.vue'
import { buildScoresheet } from '@/components/games/scoresheet/scoresheet'
import { createTestVuetify } from '@/test/utils'
import {
  defaultEventTypes,
  makeEvent,
  makeGame,
  makeMember,
  makePlayer,
  makeTeam,
} from '@/test/factories'
import type { Game } from '@/types/game'

const players = (count: number, extra = {}) =>
  Array.from({ length: count }, (_, index) =>
    makePlayer(index + 1, `Atleta ${index + 1}`, { number: index + 1, ...extra }),
  )

function makeScoresheetGame(extra: Partial<Game> = {}) {
  return makeGame(42, {
    homeTeam: makeTeam(1, 'Leões do Jardim FC', {
      players: [makePlayer(1, 'Rafael Brito', { number: 1, document: '52998224725' })],
      technicalCommitteeMembers: [makeMember(1, 'Marcos Vieira')],
    }),
    awayTeam: makeTeam(2, 'Unidos da Vila Nova', {
      players: players(3),
      technicalCommitteeMembers: [],
    }),
    league: { id: 1, name: 'Série Ouro', championship: { id: 1, name: 'Copa Leste' } },
    ...extra,
  })
}

function mountScoresheet(game: Game, eventTypes = defaultEventTypes(), blank = false) {
  return mount(GameScoresheet, {
    props: {
      data: buildScoresheet(game, {}, blank),
      eventTypes,
      generatedAt: '06/11/2026 às 18:42',
    },
    global: { plugins: [createTestVuetify()] },
  })
}

const pageChips = (wrapper: ReturnType<typeof mountScoresheet>) =>
  wrapper.findAll('[data-test="scoresheet-page"]').map((chip) => chip.text())

describe('GameScoresheet', () => {
  it('pontos corridos: relação e eventos, sem a folha de pênaltis', () => {
    const wrapper = mountScoresheet(makeScoresheetGame())

    expect(wrapper.findAll('[data-test="scoresheet-sheet"]')).toHaveLength(2)
    expect(pageChips(wrapper)).toEqual(['Pág. 1 de 2', 'Pág. 2 de 2'])
    expect(wrapper.find('[data-test="scoresheet-knockout-tag"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="scoresheet-code"]').text()).toBe('Jogo#0042')
    expect(wrapper.find('[data-test="scoresheet-competition"]').text()).toBe(
      'Copa Leste · Série Ouro',
    )
    expect(wrapper.text()).not.toContain('Preencha a disputa de pênaltis')
    expect(wrapper.text()).not.toContain('Cobranças de pênalti')
    expect(wrapper.text()).toContain('Gerado em 06/11/2026 às 18:42 · Jogo #0042 · Pág. 2 de 2')
  })

  it('relação: CPF mascarado, linhas em branco e técnico só no time que tem treinador', () => {
    const wrapper = mountScoresheet(makeScoresheetGame())
    const home = wrapper.find('[data-test="scoresheet-roster-home"]')
    const away = wrapper.find('[data-test="scoresheet-roster-away"]')

    expect(home.find('[data-test="scoresheet-coach"]').text()).toBe('Téc. Marcos Vieira')
    expect(away.find('[data-test="scoresheet-coach"]').exists()).toBe(false)
    const row = home.find('[data-test="scoresheet-player"]').findAll('td')
    expect(row.map((cell) => cell.text())).toEqual(['1', 'Rafael Brito', '***.982.247-**', ''])
    expect(home.text()).not.toContain('52998224725')
    expect(home.findAll('[data-test="scoresheet-blank"]')).toHaveLength(34)
    expect(away.findAll('[data-test="scoresheet-player"]')).toHaveLength(3)
    expect(away.findAll('tbody tr')).toHaveLength(35)
  })

  it('folha de eventos: legenda dos tipos ativos com sigla e 18 linhas', () => {
    const types = defaultEventTypes().map((type) => ({
      ...type,
      abbreviation: type.slug === 'goal' ? 'G' : null,
    }))
    const wrapper = mountScoresheet(makeScoresheetGame(), types)

    expect(
      wrapper.findAll('[data-test="scoresheet-legend-type"]').map((key) => key.text()),
    ).toEqual(['G Gol', 'GC Gol contra', 'CA Cartão amarelo', 'CV Cartão vermelho'])
    const rows = wrapper.findAll('[data-test="scoresheet-event-row"]')
    expect(rows).toHaveLength(18)
    expect(rows[0].text()).toBe('1GGCCACVMV')
  })

  it('mata-mata decisivo: terceira folha de pênaltis em branco', () => {
    const wrapper = mountScoresheet(
      makeScoresheetGame({ round: null, phase: 'Final', penalties_possible: true }),
    )

    const sheets = wrapper.findAll('[data-test="scoresheet-sheet"]')
    expect(sheets).toHaveLength(3)
    expect(pageChips(wrapper)).toEqual(['Pág. 1 de 3', 'Pág. 2 de 3', 'Pág. 3 de 3'])
    expect(sheets[2].text()).not.toContain('Somente mata-mata')
    expect(sheets[2].findAll('[data-test="scoresheet-kick"]')).toHaveLength(24)
    expect(sheets[2].text()).toContain('(Final · Jogo único · desempate: pênaltis)')
    expect(sheets[0].text()).toContain('Preencha a disputa de pênaltis na pág. 3')
    expect(sheets[1].text()).toContain('Cobranças de pênalti')
  })

  it('elenco grande ganha folha de continuação e empurra a numeração', () => {
    const game = makeScoresheetGame({ penalties_possible: true })
    game.homeTeam!.players = players(38)
    const wrapper = mountScoresheet(game)

    const sheets = wrapper.findAll('[data-test="scoresheet-sheet"]')
    expect(sheets).toHaveLength(4)
    expect(pageChips(wrapper)).toEqual(['Pág. 1 de 4', 'Pág. 2 de 4', 'Pág. 3 de 4', 'Pág. 4 de 4'])
    expect(sheets[0].text()).toContain('Preencha a disputa de pênaltis na pág. 4')
    expect(sheets[1].find('[data-test="scoresheet-title"]').text()).toBe(
      'Súmula oficial de partida - Relação de atletas (continuação)',
    )
    expect(sheets[1].find('.signs').exists()).toBe(false)
    expect(sheets[1].find('[data-test="scoresheet-match"]').exists()).toBe(false)
    const continuation = sheets[1].find('[data-test="scoresheet-roster-home"]')
    expect(
      continuation.findAll('[data-test="scoresheet-player"]').map((row) => row.text()),
    ).toEqual(['36Atleta 36', '37Atleta 37', '38Atleta 38'])
  })

  it('cabeçalho enxuto em todas as folhas, com a contagem de páginas só no rodapé', () => {
    const wrapper = mountScoresheet(
      makeScoresheetGame({ round: null, phase: 'Final', penalties_possible: true }),
    )

    expect(wrapper.findAll('[data-test="scoresheet-title"]').map((title) => title.text())).toEqual([
      'Súmula oficial de partida - Relação de atletas',
      'Súmula oficial de partida - Registro de eventos e ocorrências',
      'Súmula oficial de partida - Disputa de pênaltis',
    ])
    for (const head of wrapper.findAll('.head')) {
      expect(head.text()).not.toContain('Pág.')
      expect(head.text()).not.toContain('Página')
      expect(head.text()).not.toContain('Copa Leste')
      expect(head.text()).not.toContain('Somente mata-mata')
      expect(head.find('[data-test="scoresheet-code"]').text()).toBe('Jogo#0042')
    }
    expect(wrapper.findAll('.foot [data-test="scoresheet-page"]')).toHaveLength(3)
  })

  it('relação: sem assinaturas no rodapé, mantendo a coluna e o cartão Competição', () => {
    const sheet = mountScoresheet(makeScoresheetGame()).find('[data-test="scoresheet-sheet"]')

    expect(sheet.find('.signs').exists()).toBe(false)
    expect(sheet.find('[data-test="scoresheet-roster-home"] thead').text()).toContain('Assinatura')
    expect(sheet.findAll('.cards .label').map((label) => label.text())).toEqual([
      'Competição',
      'Rodada',
      'Local',
      'Data e horário',
      'Árbitro principal',
    ])
  })

  it('folha de eventos assina árbitro e capitães, sem assistentes', () => {
    const wrapper = mountScoresheet(makeScoresheetGame())
    const sheet = wrapper.findAll('[data-test="scoresheet-sheet"]')[1]

    expect(sheet.findAll('.sign-label').map((label) => label.text())).toEqual([
      'Árbitro principal',
      'Capitão · Leões do Jardim FC',
      'Capitão · Unidos da Vila Nova',
    ])
    expect(sheet.text()).not.toContain('assistente')
  })

  it.each([20, 25, 30])('liga com limite %i imprime essa quantidade de linhas', (limit) => {
    const game = makeScoresheetGame({
      league: { id: 1, name: 'Série', championship: null, max_players_per_team: limit },
    })
    const wrapper = mountScoresheet(game)

    expect(wrapper.find('[data-test="scoresheet-roster-home"]').findAll('tbody tr')).toHaveLength(
      limit,
    )
    expect(wrapper.find('[data-test="scoresheet-roster-away"]').findAll('tbody tr')).toHaveLength(
      limit,
    )
    expect(wrapper.find('.teams').attributes('style')).toContain(`--roster-rows: ${limit}`)
  })

  it('limite 20 com elenco de 23: continuação com 20 linhas, sem cortar atletas', () => {
    const game = makeScoresheetGame({
      league: { id: 1, name: 'Série', championship: null, max_players_per_team: 20 },
    })
    game.homeTeam!.players = players(23)
    const wrapper = mountScoresheet(game)

    const sheets = wrapper.findAll('[data-test="scoresheet-sheet"]')
    expect(sheets).toHaveLength(3)
    expect(sheets[0].find('[data-test="scoresheet-roster-home"]').text()).toContain('Atleta 20')
    const continuation = sheets[1].find('[data-test="scoresheet-roster-home"]')
    expect(continuation.findAll('tbody tr')).toHaveLength(20)
    expect(
      continuation.findAll('[data-test="scoresheet-player"]').map((row) => row.text()),
    ).toEqual(['21Atleta 21', '22Atleta 22', '23Atleta 23'])
  })

  describe('preenchida', () => {
    const finished = (extra: Partial<Game> = {}) =>
      makeScoresheetGame({
        status: 'finished',
        home_score: 2,
        away_score: 0,
        events: [
          makeEvent(2, {
            minute: 70,
            team_id: 2,
            type: 'yellow_card',
            player: { id: 8, name: 'Atleta Oito', number: 8, removed: false },
          }),
          makeEvent(1, {
            minute: 12,
            team_id: 1,
            player: { id: 1, name: 'Rafael Brito', number: 1, removed: false },
            related_player: { id: 3, name: 'Passador', number: 3, removed: false },
          }),
        ],
        ...extra,
      })

    const knockout = (extra: Partial<Game> = {}) =>
      finished({
        round: null,
        phase: 'Final',
        penalties_possible: true,
        home_penalties: 2,
        away_penalties: 1,
        penaltyKicks: [
          { id: 1, order: 1, team_id: 2, player_id: 1, scored: true },
          { id: 2, order: 2, team_id: 1, player_id: 2, scored: true },
          { id: 3, order: 3, team_id: 2, player_id: 3, scored: false },
          { id: 4, order: 4, team_id: 1, player_id: 4, scored: true },
        ].map((kick) => ({
          ...kick,
          player: {
            id: kick.player_id,
            name: 'João Silva',
            number: kick.player_id,
            removed: false,
          },
        })),
        ...extra,
      })

    const marks = (row: { findAll: ReturnType<typeof mountScoresheet>['findAll'] }) =>
      row
        .findAll('.opt')
        .filter((option) => option.find('.cb.on').exists())
        .map((option) => option.text())

    it('folha 1: placar nas caixas, sem o aviso de empate e árbitro em branco', () => {
      const wrapper = mountScoresheet(knockout())
      const first = wrapper.findAll('[data-test="scoresheet-sheet"]')[0]

      expect(first.find('[data-test="scoresheet-score-home"]').text()).toBe('2')
      expect(first.find('[data-test="scoresheet-score-away"]').text()).toBe('0')
      expect(first.find('[data-test="scoresheet-penalties-score"]').text()).toBe('Pênaltis: 2 × 1')
      expect(first.text()).not.toContain('Terminou empatado')
      expect(first.find('[data-test="scoresheet-roster-hint"]').text()).toBe(
        'Relação conforme o cadastro atual do time',
      )
      expect(first.findAll('.card.fill .write-line').length).toBeGreaterThan(0)
      expect(first.find('.signs').exists()).toBe(false)
    })

    it('folha 2: eventos em ordem, com X no tipo e no time, e ocorrências na largura toda', () => {
      const wrapper = mountScoresheet(finished())
      const rows = wrapper.findAll('[data-test="scoresheet-event-row"]')

      expect(rows).toHaveLength(18)
      expect(
        rows[0].findAll('td').map((cell, index) => (index === 2 || index === 3 ? '' : cell.text())),
      ).toEqual(['1', '12', '', '', '1', 'Rafael Brito', '3', 'Assist.: Passador'])
      expect(marks(rows[0])).toEqual(['G', 'M'])
      expect(marks(rows[1])).toEqual(['CA', 'V'])
      expect(marks(rows[2])).toEqual([])
      expect(rows[2].text()).toBe('3GGCCACVMV')
      expect(wrapper.find('[data-test="scoresheet-legend"]').text()).toContain('Legenda')
      expect(wrapper.find('[data-test="scoresheet-legend"]').text()).not.toContain('Marque com X')
      expect(wrapper.text()).not.toContain('Mais eventos do que linhas')
      expect(wrapper.find('.office').exists()).toBe(false)
      expect(wrapper.find('.bottom.single').exists()).toBe(true)
    })

    it('mais de 18 eventos: folha de continuação segue a numeração e as páginas', () => {
      const wrapper = mountScoresheet(
        knockout({
          events: Array.from({ length: 20 }, (_, index) =>
            makeEvent(index + 1, { minute: index + 1 }),
          ),
        }),
      )

      const sheets = wrapper.findAll('[data-test="scoresheet-sheet"]')
      expect(sheets).toHaveLength(4)
      expect(pageChips(wrapper)).toEqual([
        'Pág. 1 de 4',
        'Pág. 2 de 4',
        'Pág. 3 de 4',
        'Pág. 4 de 4',
      ])
      expect(sheets[2].find('[data-test="scoresheet-title"]').text()).toBe(
        'Súmula oficial de partida - Registro de eventos (continuação)',
      )
      expect(sheets[2].findAll('.sign-label').map((label) => label.text())).toEqual([
        'Árbitro principal',
        'Capitão · Leões do Jardim FC',
        'Capitão · Unidos da Vila Nova',
      ])
      const continuation = sheets[2].findAll('[data-test="scoresheet-event-row"]')
      expect(continuation).toHaveLength(18)
      expect(continuation[0].find('.idx').text()).toBe('19')
      expect(continuation[1].findAll('td')[1].text()).toBe('20')
      expect(continuation[2].findAll('td')[1].text()).toBe('')
      expect(sheets[3].find('[data-test="scoresheet-kicks"]').exists()).toBe(true)
    })

    it('folha 3: cobranças, quem bateu primeiro, total, resultado e vencedor', () => {
      const wrapper = mountScoresheet(knockout())
      const sheet = wrapper.findAll('[data-test="scoresheet-sheet"]')[2]
      const home = sheet.find('[data-test="scoresheet-kicks-home"]')
      const away = sheet.find('[data-test="scoresheet-kicks-away"]')

      expect(home.findAll('.mark .fill')).toHaveLength(2)
      expect(home.findAll('.mark .cross')).toHaveLength(0)
      expect(away.findAll('.mark .fill')).toHaveLength(1)
      expect(away.findAll('.mark .cross')).toHaveLength(1)
      expect(
        away
          .findAll('.kick-line')
          .map((line) => line.text())
          .slice(0, 3),
      ).toEqual(['1', '3', ''])
      expect(away.find('.kteam .cb').classes()).toContain('on')
      expect(home.find('.kteam .cb').classes()).not.toContain('on')
      expect(home.find('.total-box').text()).toBe('2')
      expect(away.find('.total-box').text()).toBe('1')
      expect(sheet.find('[data-test="scoresheet-shootout-home"]').text()).toBe('2')
      expect(sheet.find('[data-test="scoresheet-shootout-away"]').text()).toBe('1')
      expect(sheet.find('[data-test="scoresheet-winner-home"] .cb').classes()).toContain('on')
      expect(sheet.find('[data-test="scoresheet-winner-away"] .cb').classes()).not.toContain('on')
      expect(sheet.findAll('.score-mini .sbox').map((box) => box.text())).toEqual(['2', '0'])
      expect(sheet.text()).not.toContain('Quando preencher')
      expect(sheet.text()).not.toContain('Escritório: cobranças digitadas')
      expect(sheet.text()).not.toContain('Como marcar')
      expect(sheet.text()).toContain('Legenda')
      expect(sheet.text()).toContain('Final · Jogo único · desempate: pênaltis')
      expect(sheet.findAll('.sign-line')).toHaveLength(3)
    })

    it('mais de 12 cobranças por time: a grade cresce em colunas', () => {
      const penaltyKicks = Array.from({ length: 30 }, (_, index) => ({
        id: index + 1,
        order: index + 1,
        team_id: index % 2 === 0 ? 1 : 2,
        player_id: index + 1,
        scored: index % 2 === 0,
      }))
      const wrapper = mountScoresheet(knockout({ penaltyKicks }))
      const table = wrapper.find('[data-test="scoresheet-kicks"]')

      expect(table.classes()).toContain('compact')
      expect(table.findAll('[data-test="scoresheet-kick"]')).toHaveLength(30)
      expect(table.findAll('tr.nums th')).toHaveLength(17)
      expect(table.find('tr.groups th.sd').attributes('colspan')).toBe('10')
    })

    it('jogo antigo só com placar: sem a folha 3 e com o placar na folha 1', () => {
      const wrapper = mountScoresheet(knockout({ penaltyKicks: [] }))

      expect(wrapper.findAll('[data-test="scoresheet-sheet"]')).toHaveLength(2)
      expect(wrapper.find('[data-test="scoresheet-penalties-score"]').text()).toBe(
        'Pênaltis: 2 × 1',
      )
    })

    it('rodapé indica a origem dos dados só na preenchida', () => {
      expect(mountScoresheet(finished()).text()).toContain(
        'Gerado em 06/11/2026 às 18:42 a partir dos dados do Futy',
      )
      expect(mountScoresheet(finished(), defaultEventTypes(), true).text()).not.toContain(
        'a partir dos dados do Futy',
      )
    })

    it('em branco, a mesma partida volta ao formulário vazio', () => {
      const wrapper = mountScoresheet(knockout(), defaultEventTypes(), true)
      const sheets = wrapper.findAll('[data-test="scoresheet-sheet"]')

      expect(sheets).toHaveLength(3)
      expect(wrapper.find('[data-test="scoresheet-score-home"]').text()).toBe('')
      expect(wrapper.find('.cb.on').exists()).toBe(false)
      expect(wrapper.find('[data-test="scoresheet-kick"] .fill').exists()).toBe(false)
      expect(sheets[0].text()).toContain('Preencha a disputa de pênaltis na pág. 3')
      expect(sheets[1].text()).toContain('Marque com X')
      expect(sheets[1].find('.office').exists()).toBe(true)
      expect(sheets[2].text()).toContain('Quando preencher')
      expect(sheets[2].find('[data-test="scoresheet-kicks"]').classes()).not.toContain('compact')
    })
  })
})
