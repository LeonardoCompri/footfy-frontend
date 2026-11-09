import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PenaltyShootoutGrid from '@/components/games/PenaltyShootoutGrid.vue'
import type { ShootoutGridKick } from '@/components/games/shootout'
import { createTestVuetify } from '@/test/utils'

const home = { id: 1, name: 'Serrano' }
const away = { id: 2, name: 'Ribeirinho' }

function mountGrid(props: Record<string, unknown>) {
  return mount(PenaltyShootoutGrid, {
    props: { home, away, kicks: [], ...props },
    global: { plugins: [createTestVuetify()] },
  })
}

function sequence(first: string, second: string, homeFirst = true): ShootoutGridKick[] {
  const teams = homeFirst ? [home.id, away.id] : [away.id, home.id]
  const kicks: ShootoutGridKick[] = []
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    ;[first, second].forEach((pattern, side) => {
      if (i < pattern.length) {
        kicks.push({
          team_id: teams[side],
          number: (side + 1) * 10 + i,
          name: `Jogador ${side}-${i}`,
          scored: pattern[i] === 'G',
        })
      }
    })
  }
  return kicks
}

function cells(wrapper: ReturnType<typeof mountGrid>, side: 'home' | 'away') {
  return wrapper.findAll(`[data-test="shootout-row-${side}"] [data-test="shootout-kick"]`)
}

describe('PenaltyShootoutGrid', () => {
  it('grade em branco tem as 5 regulamentares por time e marca quem bate primeiro', () => {
    const wrapper = mountGrid({ firstTeamId: 2 })

    expect(cells(wrapper, 'home')).toHaveLength(5)
    expect(cells(wrapper, 'away').map((cell) => cell.attributes('data-result'))).toEqual(
      Array(5).fill('empty'),
    )
    expect(
      wrapper.find('[data-test="shootout-row-away"] [data-test="shootout-first"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[data-test="shootout-row-home"] [data-test="shootout-first"]').exists(),
    ).toBe(false)
    expect(wrapper.find('[data-test="shootout-sudden-death"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="shootout-result"]').exists()).toBe(false)
  })

  it('mostra nº do cobrador, convertido e perdido, total e o resultado', () => {
    const wrapper = mountGrid({ kicks: sequence('GGG', 'XXX', false) })

    const homeCells = cells(wrapper, 'home')
    expect(homeCells.slice(0, 3).map((cell) => cell.find('.num').text())).toEqual([
      '20',
      '21',
      '22',
    ])
    expect(homeCells.map((cell) => cell.attributes('data-result'))).toEqual([
      'missed',
      'missed',
      'missed',
      'empty',
      'empty',
    ])
    expect(
      cells(wrapper, 'away')
        .slice(0, 3)
        .map((cell) => cell.attributes('data-result')),
    ).toEqual(['scored', 'scored', 'scored'])
    expect(homeCells[0].find('.cross').exists()).toBe(true)
    expect(cells(wrapper, 'away')[0].find('.fill').exists()).toBe(true)
    expect(cells(wrapper, 'away')[0].attributes('aria-label')).toBe(
      'Cobrança 1: nº 10, Jogador 0-0, convertido',
    )
    expect(
      wrapper.find('[data-test="shootout-row-away"] [data-test="shootout-first"]').exists(),
    ).toBe(true)
    expect(wrapper.findAll('[data-test="shootout-total"]').map((cell) => cell.text())).toEqual([
      '0',
      '3',
    ])
    expect(
      wrapper.find('[data-test="shootout-row-away"] [data-test="shootout-total"]').classes(),
    ).toContain('winner')
    expect(wrapper.find('[data-test="shootout-result"]').text()).toBe(
      'Disputa decidida: 0 × 3, Ribeirinho vence',
    )
  })

  it('cresce com as alternadas na morte súbita', () => {
    const wrapper = mountGrid({ kicks: sequence('GGGGGGX', 'GGGGGGG') })

    expect(cells(wrapper, 'home')).toHaveLength(7)
    expect(wrapper.find('[data-test="shootout-sudden-death"]').attributes('colspan')).toBe('2')
    expect(wrapper.find('[data-test="shootout-result"]').text()).toBe(
      'Disputa decidida: 6 × 7, Ribeirinho vence',
    )
  })

  it('ao vivo mostra o placar parcial e a cobrança sem resultado', () => {
    const kicks = [...sequence('GG', 'X'), { team_id: 2, number: 7, scored: null }]
    const wrapper = mountGrid({ kicks, live: true })

    expect(cells(wrapper, 'away')[1].attributes('data-result')).toBe('pending')
    expect(wrapper.find('[data-test="shootout-result"]').text()).toBe('Placar parcial: 2 × 0')
  })

  it('marca o lado com cobranças escondidas sob as colunas fixas ao rolar', async () => {
    const wrapper = mountGrid({ kicks: sequence('GGGGGGGG', 'GGGGGGGX') })
    const scroll = wrapper.find('[data-test="shootout-scroll"]')
    const el = scroll.element as HTMLElement
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 296 })
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 420 })

    await scroll.trigger('scroll')
    expect(scroll.classes()).toContain('hidden-right')
    expect(scroll.classes()).not.toContain('hidden-left')

    el.scrollLeft = 124
    await scroll.trigger('scroll')
    expect(scroll.classes()).toContain('hidden-left')
    expect(scroll.classes()).not.toContain('hidden-right')
  })

  it('jogo antigo sem cobranças mostra só o placar dos pênaltis', () => {
    const wrapper = mountGrid({ homePenalties: 4, awayPenalties: 3 })

    expect(wrapper.find('[data-test="shootout-kick"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="shootout-result"]').text()).toBe(
      'Pênaltis: 4 × 3, Serrano vence',
    )
    expect(wrapper.find('[data-test="shootout-legacy"]').exists()).toBe(true)
  })
})
