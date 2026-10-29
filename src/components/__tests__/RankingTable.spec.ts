import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RankingTable from '@/components/leagues/RankingTable.vue'
import type { RankingColumn } from '@/components/leagues/RankingTable.vue'
import { createTestVuetify } from '@/test/utils'

const columns: RankingColumn[] = [
  { key: 'yellow_cards', title: 'Cartões amarelos', icon: 'mdi-card', iconColor: '#eda100', width: 36 },
  { key: 'red_cards', title: 'Cartões vermelhos', icon: 'mdi-card', iconColor: '#d32f2f', width: 36 },
  { key: 'total_cards', title: 'Total', width: 64 },
]

const rows = [
  {
    player_id: 1,
    player_name: 'Dr. Márcio Ferreira Sobrinho de Albuquerque',
    player_removed: false,
    team_id: 1,
    team_name: 'Clube Atlético Mineiro',
    team_nickname: 'Atlético-MG',
    yellow_cards: 2,
    red_cards: 1,
    total_cards: 3,
  },
]

function mountTable() {
  return mount(RankingTable, {
    props: { title: 'Cartões', icon: 'mdi-card', rows, columns, emptyText: 'Vazio' },
    global: { plugins: [createTestVuetify()] },
  })
}

describe('RankingTable', () => {
  it('fixa a largura das colunas numéricas para o nome truncar em vez de gerar rolagem', () => {
    const wrapper = mountTable()

    expect(wrapper.find('.ranking-table').exists()).toBe(true)
    const widths = wrapper.findAll('col').map((col) => (col.element as HTMLElement).style.width)
    // # e Jogador ficam a cargo do CSS (Jogador ocupa o restante); numéricas usam `width`.
    expect(widths.slice(2)).toEqual(['36px', '36px', '64px'])
    expect(wrapper.find('[data-test="ranking-row"] td:nth-child(2)').attributes('title')).toBe(rows[0].player_name)
  })

  it('colunas com ícone mostram só o ícone e mantêm o título como tooltip; Total segue visível', () => {
    const wrapper = mountTable()

    const headers = wrapper.findAll('[data-test="ranking-column"]')
    expect(headers.map((th) => th.text())).toEqual(['', '', 'Total'])
    expect(headers[0].attributes('title')).toBe('Cartões amarelos')
    expect(headers[0].find('.v-icon').attributes('aria-label')).toBe('Cartões amarelos')
    expect(headers[2].attributes('title')).toBeUndefined()
    expect(wrapper.find('[data-test="ranking-row"]').text()).toContain('213')
  })

  it('jogador removido do elenco mostra o selo "removido" ao lado do nome; ativo não', () => {
    const wrapper = mount(RankingTable, {
      props: {
        title: 'Cartões',
        icon: 'mdi-card',
        rows: [
          rows[0],
          { ...rows[0], player_id: 2, player_name: 'Zé Removido', player_removed: true },
        ],
        columns,
        emptyText: 'Vazio',
      },
      global: { plugins: [createTestVuetify()] },
    })

    const names = wrapper.findAll('[data-test="ranking-row"] td:nth-child(2)')
    expect(names[0].find('[data-test="removed-badge"]').exists()).toBe(false)
    expect(names[1].text()).toContain('Zé Removido')
    expect(names[1].find('[data-test="removed-badge"]').text()).toBe('removido')
  })

  it('sem linhas mostra o texto de vazio', () => {
    const wrapper = mount(RankingTable, {
      props: { title: 'Cartões', icon: 'mdi-card', rows: [], columns, emptyText: 'Nenhum cartão.' },
      global: { plugins: [createTestVuetify()] },
    })

    expect(wrapper.text()).toContain('Nenhum cartão.')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
