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
})
