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

  it('nova partida não mostra status nem gols e nasce agendada, sem placar', async () => {
    vi.mocked(gamesService.create).mockResolvedValue(makeGame(9))
    const wrapper = await mountDialog()

    expect(has('game-status')).toBe(false)
    expect(has('game-home-score')).toBe(false)
    expect(has('game-away-score')).toBe(false)
    await choose(wrapper, 'VAutocomplete', 'game-home-team', 1)
    await choose(wrapper, 'VAutocomplete', 'game-away-team', 2)
    await submit()

    expect(gamesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'scheduled', home_score: null, away_score: null }),
    )
  })

  it('edição mostra status e gols e envia o que foi alterado', async () => {
    vi.mocked(gamesService.update).mockResolvedValue(makeGame(3))
    const wrapper = await mountDialog(
      makeGame(3, { league_id: 7, round: 1, status: 'in_progress', home_score: 1, away_score: 0 }),
    )

    expect(has('game-status')).toBe(true)
    expect(has('game-home-score')).toBe(true)
    expect(has('game-away-score')).toBe(true)
    await choose(wrapper, 'VSelect', 'game-status', 'finished')
    await choose(wrapper, 'VTextField', 'game-home-score', '2')
    await submit()

    expect(gamesService.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ status: 'finished', home_score: 2, away_score: 0 }),
    )
  })
})
