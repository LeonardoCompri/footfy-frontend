import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GameFormDialog from '@/components/games/GameFormDialog.vue'
import { gamesService } from '@/services/api/games.service'
import { createTestVuetify } from '@/test/utils'
import { makeGame, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/games.service', () => ({
  gamesService: { create: vi.fn(), update: vi.fn() },
}))

const teams = [makeTeam(1, 'Flamengo'), makeTeam(2, 'Bahia')]

async function mountDialog(game: ReturnType<typeof makeGame> | null = null) {
  const wrapper = mount(GameFormDialog, {
    props: { modelValue: true, leagueId: 7, format: 'round_robin', teams, stadiums: [], game },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function has(test: string) {
  return document.querySelector(`[data-test="${test}"]`) !== null
}

async function choose(wrapper: VueWrapper, name: string, test: string, value: unknown) {
  const field = wrapper
    .findAllComponents({ name })
    .find((component) => component.attributes('data-test') === test)
  field!.vm.$emit('update:modelValue', value)
  await flushPromises()
}

function submit() {
  ;(document.querySelector('[data-test="form-submit"]') as HTMLButtonElement).click()
  return flushPromises()
}

describe('GameFormDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('nova partida não mostra status nem gols e nasce agendada, sem enviar placar', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    const wrapper = await mountDialog()

    expect(has('game-status')).toBe(false)
    expect(has('game-home-score')).toBe(false)
    expect(has('game-away-score')).toBe(false)
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await submit()

    const payload = vi.mocked(gamesService.create).mock.calls[0][0]
    expect(payload).toMatchObject({ status: 'scheduled', home_team_id: 1, away_team_id: 2 })
    expect(payload).not.toHaveProperty('home_score')
    expect(payload).not.toHaveProperty('away_score')
  })

  it('edição mostra status, sem campos de gols, e não envia o placar (calculado pela súmula)', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(makeGame(3))
    const wrapper = await mountDialog(
      makeGame(3, { league_id: 7, round: 1, status: 'in_progress', home_score: 1, away_score: 0 }),
    )

    expect(has('game-status')).toBe(true)
    expect(has('game-home-score')).toBe(false)
    expect(has('game-away-score')).toBe(false)
    await choose(wrapper, 'VSelect', 'game-status', 'finished')
    await submit()

    const [id, payload] = vi.mocked(gamesService.update).mock.calls[0]
    expect(id).toBe(3)
    expect(payload).toMatchObject({ status: 'finished', round: 1 })
    expect(payload).not.toHaveProperty('home_score')
    expect(payload).not.toHaveProperty('away_score')
  })

  function fieldOrder() {
    return [...document.querySelectorAll('.v-dialog [data-test^="game-"]')].map((el) =>
      el.getAttribute('data-test'),
    )
  }

  function colWidths(test: string) {
    const col = document.querySelector(`[data-test="${test}"]`)!.parentElement!
    return [...col.classList].filter((name) => /^v-col-(sm-)?\d+$/.test(name)).sort()
  }

  it('disposição: times em linhas próprias, status + data, rodada + estádio', async () => {
    await mountDialog(makeGame(3, { league_id: 7, round: 1 }))

    expect(fieldOrder()).toEqual([
      'game-home-team',
      'game-away-team',
      'game-status',
      'game-match-date',
      'game-round',
      'game-stadium',
    ])
    expect(colWidths('game-home-team')).toEqual(['v-col-12'])
    expect(colWidths('game-away-team')).toEqual(['v-col-12'])
    for (const test of ['game-status', 'game-match-date', 'game-round', 'game-stadium']) {
      expect(colWidths(test)).toEqual(['v-col-12', 'v-col-sm-6'])
    }
  })

  it('na criação, sem status, a data ocupa a linha inteira', async () => {
    await mountDialog()

    expect(fieldOrder()).toEqual([
      'game-home-team',
      'game-away-team',
      'game-match-date',
      'game-round',
      'game-stadium',
    ])
    expect(colWidths('game-match-date')).toEqual(['v-col-12', 'v-col-sm-12'])
  })

  it('mata-mata: a fase fica no lugar da rodada e ordem, confronto e perna logo abaixo', async () => {
    document.body.innerHTML = ''
    mount(GameFormDialog, {
      props: { modelValue: true, leagueId: 7, format: 'knockout', teams, stadiums: [], game: null },
      global: { plugins: [createTestVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    expect(fieldOrder()).toEqual([
      'game-home-team',
      'game-away-team',
      'game-match-date',
      'game-phase',
      'game-stadium',
      'game-phase-order',
      'game-tie-key',
      'game-leg',
    ])
  })
})
