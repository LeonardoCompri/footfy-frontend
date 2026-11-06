import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TiebreakerList from '@/components/leagues/TiebreakerList.vue'
import { createTestVuetify } from '@/test/utils'
import { DEFAULT_TIEBREAKERS, type Tiebreaker } from '@/types/leagueRules'

function mountList(modelValue: Tiebreaker[]) {
  const wrapper = mount(TiebreakerList, {
    props: {
      modelValue,
      'onUpdate:modelValue': (value: Tiebreaker[]) => wrapper.setProps({ modelValue: value }),
    },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  return wrapper
}

function labels(wrapper: ReturnType<typeof mountList>) {
  return wrapper.findAll('[data-test="tiebreaker-item"] .v-list-item-title').map((t) => t.text())
}

describe('TiebreakerList', () => {
  it('mostra a lista em ordem, com Pontos fixo e sem botões', async () => {
    const wrapper = mountList([...DEFAULT_TIEBREAKERS])

    expect(labels(wrapper)).toEqual([
      'Pontos',
      'Vitórias',
      'Saldo de gols',
      'Gols marcados',
      'Confronto direto',
      'Menos cartões',
    ])
    const [first, second] = wrapper.findAll('[data-test="tiebreaker-item"]')
    expect(first.find('[data-test="tiebreaker-remove"]').exists()).toBe(false)
    expect(first.find('[aria-label="Critério fixo"]').exists()).toBe(true)
    expect(second.find('[data-test="tiebreaker-up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="tiebreakers-default"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="tiebreakers-restore"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('sobe, desce e remove critérios', async () => {
    const wrapper = mountList(['points', 'wins', 'goals_for', 'head_to_head'])

    await wrapper.find('[aria-label="Subir Gols marcados"]').trigger('click')
    expect(labels(wrapper)).toEqual(['Pontos', 'Gols marcados', 'Vitórias', 'Confronto direto'])

    await wrapper.find('[aria-label="Descer Gols marcados"]').trigger('click')
    expect(labels(wrapper)).toEqual(['Pontos', 'Vitórias', 'Gols marcados', 'Confronto direto'])

    await wrapper.find('[aria-label="Remover Vitórias"]').trigger('click')
    expect(labels(wrapper)).toEqual(['Pontos', 'Gols marcados', 'Confronto direto'])
    wrapper.unmount()
  })

  it('o select de inclusão só oferece critérios fora da lista e adiciona no fim', async () => {
    const wrapper = mountList(['points', 'wins'])
    const select = wrapper.findComponent({ name: 'VSelect' })
    const offered = (select.props('items') as { value: string }[]).map((item) => item.value)

    expect(offered).not.toContain('points')
    expect(offered).not.toContain('wins')
    expect(offered).toHaveLength(7)

    select.vm.$emit('update:modelValue', 'goals_against')
    await flushPromises()
    expect(labels(wrapper)).toEqual(['Pontos', 'Vitórias', 'Menos gols sofridos'])
    expect(select.props('modelValue')).toBeNull()
    wrapper.unmount()
  })

  it('"Restaurar padrão" volta para a lista padrão', async () => {
    const wrapper = mountList(['points', 'goals_against'])

    await wrapper.find('[data-test="tiebreakers-restore"]').trigger('click')
    expect(wrapper.props('modelValue')).toEqual(DEFAULT_TIEBREAKERS)
    expect(wrapper.find('[data-test="tiebreakers-default"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('mostra o erro do campo', () => {
    const wrapper = mount(TiebreakerList, {
      props: {
        modelValue: ['points'],
        errorMessages: ['Os critérios de desempate não podem se repetir.'],
      },
      global: { plugins: [createTestVuetify()] },
    })
    expect(wrapper.find('[data-test="tiebreakers-error"]').text()).toBe(
      'Os critérios de desempate não podem se repetir.',
    )
  })
})
