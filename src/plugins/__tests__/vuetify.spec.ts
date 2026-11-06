import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { VAutocomplete, VCombobox, VSelect, VTextarea, VTextField } from 'vuetify/components'
import vuetify from '@/plugins/vuetify'

describe('defaults do Vuetify', () => {
  it.each([
    ['VTextField', VTextField],
    ['VSelect', VSelect],
    ['VAutocomplete', VAutocomplete],
    ['VCombobox', VCombobox],
    ['VTextarea', VTextarea],
  ] as [string, Component][])('%s usa a variante outlined e densidade comfortable', (_, field) => {
    const wrapper = mount(field, { props: { label: 'Campo' }, global: { plugins: [vuetify] } })

    expect(wrapper.find('.v-field').classes()).toContain('v-field--variant-outlined')
    expect(wrapper.find('.v-input').classes()).toContain('v-input--density-comfortable')
  })
})

describe('cores de cartão do tema', () => {
  it.each([
    ['footfyLight', '#eda100', '#e34948'],
    ['footfyDark', '#c98500', '#d03b3b'],
  ])('%s tem card-yellow e card-red', (theme, yellow, red) => {
    const { colors } = vuetify.theme.themes.value[theme]
    expect(colors['card-yellow']?.toLowerCase()).toBe(yellow)
    expect(colors['card-red']?.toLowerCase()).toBe(red)
  })
})
