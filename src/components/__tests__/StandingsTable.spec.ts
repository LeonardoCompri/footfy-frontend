import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsTable from '@/components/leagues/StandingsTable.vue'
import type { StandingRow } from '@/types/leagueStats'
import { createTestVuetify } from '@/test/utils'

function makeRow(id: number, name: string, nickname: string | null, logo: string | null): StandingRow {
  return {
    team_id: id,
    team: { id, name, nickname, logo },
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  }
}

describe('StandingsTable', () => {
  it('mostra o escudo do time e, sem escudo, as iniciais', () => {
    const wrapper = mount(StandingsTable, {
      props: {
        rows: [
          makeRow(1, 'Sport Club Corinthians Paulista', 'Corinthians', 'http://api/storage/teams/c.jpg'),
          makeRow(2, 'Santos Futebol Clube', 'Santos', null),
        ],
      },
      global: { plugins: [createTestVuetify()] },
    })

    const [withLogo, withoutLogo] = wrapper.findAll('[data-test="standings-row"]')
    expect(withLogo.findComponent({ name: 'VImg' }).props('src')).toBe('http://api/storage/teams/c.jpg')
    expect(withoutLogo.findComponent({ name: 'VImg' }).exists()).toBe(false)
    expect(withoutLogo.find('.v-avatar').text()).toBe('SA')
  })

  it('legenda: sem tiebreakers usa o padrão e sem empate técnico não mostra o selo', () => {
    const wrapper = mount(StandingsTable, {
      props: { rows: [makeRow(1, 'Santos Futebol Clube', 'Santos', null)] },
      global: { plugins: [createTestVuetify()] },
    })

    expect(wrapper.find('[data-test="standings-tiebreakers"]').text()).toBe(
      'Desempate: vitórias, saldo de gols, gols marcados, confronto direto e menos cartões.',
    )
    expect(wrapper.find('[data-test="standings-tied"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="standings-legend-tied"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="standings-qualified"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="standings-title"]').exists()).toBe(false)
  })

  it('marca o empate técnico na linha, com legenda, e usa os tiebreakers da API', () => {
    const wrapper = mount(StandingsTable, {
      props: {
        rows: [
          { ...makeRow(1, 'Avaí Futebol Clube', 'Avaí', null), tied: true },
          { ...makeRow(2, 'Bahia', null, null), tied: true },
          { ...makeRow(3, 'Ceará', null, null), tied: false },
        ],
        tiebreakers: ['points', 'goals_for', 'fewer_yellow_cards'],
      },
      global: { plugins: [createTestVuetify()] },
    })

    const rows = wrapper.findAll('[data-test="standings-row"]')
    expect(rows.map((r) => r.find('[data-test="standings-tied"]').exists())).toEqual([
      true,
      true,
      false,
    ])
    expect(rows[0].find('[data-test="standings-tied"]').attributes('aria-label')).toBe(
      'Empate técnico: ordem alfabética',
    )
    expect(wrapper.find('[data-test="standings-legend-tied"]').text()).toBe(
      'Empate técnico: ordem alfabética.',
    )
    expect(wrapper.find('[data-test="standings-tiebreakers"]').text()).toBe(
      'Desempate: gols marcados e menos cartões amarelos.',
    )
  })

  it('destaca as posições classificadas e esconde a legenda quando pedido', () => {
    const wrapper = mount(StandingsTable, {
      props: {
        rows: [1, 2, 3].map((id) => makeRow(id, `Time ${id}`, null, null)),
        title: 'Grupo B',
        qualifiers: 2,
        hideLegend: true,
      },
      global: { plugins: [createTestVuetify()] },
    })

    expect(wrapper.find('[data-test="standings-title"]').text()).toBe('Grupo B')
    const rows = wrapper.findAll('[data-test="standings-row"]')
    expect(rows.map((r) => r.find('[data-test="standings-qualified"]').exists())).toEqual([
      true,
      true,
      false,
    ])
    expect(rows[1].find('[data-test="standings-qualified"]').text()).toBe('2')
    expect(wrapper.find('[data-test="standings-legend"]').exists()).toBe(false)
  })
})
