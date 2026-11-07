import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GameScoresheet from '@/components/games/scoresheet/GameScoresheet.vue'
import { buildScoresheet } from '@/components/games/scoresheet/scoresheet'
import { createTestVuetify } from '@/test/utils'
import { defaultEventTypes, makeGame, makeMember, makePlayer, makeTeam } from '@/test/factories'
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

function mountScoresheet(game: Game, eventTypes = defaultEventTypes()) {
  return mount(GameScoresheet, {
    props: { data: buildScoresheet(game), eventTypes, generatedAt: '06/11/2026 às 18:42' },
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
      'Copa Leste›Série Ouro',
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
    expect(home.findAll('[data-test="scoresheet-blank"]')).toHaveLength(16)
    expect(away.findAll('[data-test="scoresheet-player"]')).toHaveLength(3)
    expect(away.findAll('tbody tr')).toHaveLength(17)
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
    expect(sheets[2].find('[data-test="scoresheet-knockout-tag"]').text()).toBe('Somente mata-mata')
    expect(sheets[2].findAll('[data-test="scoresheet-kick"]')).toHaveLength(24)
    expect(sheets[2].text()).toContain('(Final · Jogo único · desempate: pênaltis)')
    expect(sheets[0].text()).toContain('Preencha a disputa de pênaltis na pág. 3')
    expect(sheets[1].text()).toContain('Cobranças de pênalti')
  })

  it('elenco grande ganha folha de continuação e empurra a numeração', () => {
    const game = makeScoresheetGame({ penalties_possible: true })
    game.homeTeam!.players = players(20)
    const wrapper = mountScoresheet(game)

    const sheets = wrapper.findAll('[data-test="scoresheet-sheet"]')
    expect(sheets).toHaveLength(4)
    expect(pageChips(wrapper)).toEqual(['Pág. 1 de 4', 'Pág. 2 de 4', 'Pág. 3 de 4', 'Pág. 4 de 4'])
    expect(sheets[0].text()).toContain('Preencha a disputa de pênaltis na pág. 4')
    expect(sheets[1].text()).toContain('Página 2 · Relação de atletas (continuação)')
    expect(sheets[1].find('[data-test="scoresheet-match"]').exists()).toBe(false)
    const continuation = sheets[1].find('[data-test="scoresheet-roster-home"]')
    expect(
      continuation.findAll('[data-test="scoresheet-player"]').map((row) => row.text()),
    ).toEqual(['18Atleta 18', '19Atleta 19', '20Atleta 20'])
  })
})
