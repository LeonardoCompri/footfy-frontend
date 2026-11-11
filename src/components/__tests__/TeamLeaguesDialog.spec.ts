import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamLeaguesDialog from '@/components/teams/TeamLeaguesDialog.vue'
import LeagueLinksDialog from '@/components/common/LeagueLinksDialog.vue'
import { teamsService } from '@/services/api/teams.service'
import { useSnackbar } from '@/composables/useSnackbar'
import {
  championshipA,
  createTestVuetify,
  makeLeague,
  makeUser,
  setupLeagueSession,
} from '@/test/utils'
import { apiError, makeTeam } from '@/test/factories'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/teams.service', () => ({
  teamsService: { attachLeagues: vi.fn(), detachLeague: vi.fn() },
}))

const DRAWN_MESSAGE =
  'Não é possível adicionar o time à liga Série B porque ela já tem rodadas sorteadas.'

describe('TeamLeaguesDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('time acima do limite da liga mostra o 422 do back', async () => {
    const message = 'O time Vitória tem 32 atletas e a liga Série B permite 30.'
    setupLeagueSession(makeUser('admin', ['team:update']), [
      makeLeague(1, championshipA, { name: 'Série A' }),
      makeLeague(2, championshipA, { name: 'Série B', max_players_per_team: 30 }),
    ])
    vi.mocked(teamsService.attachLeagues).mockRejectedValue(apiError(422, message))
    const wrapper = mount(TeamLeaguesDialog, {
      props: {
        modelValue: true,
        team: makeTeam(5, 'Vitória', { leagues: [{ id: 1, name: 'Série A' }] }),
      },
      global: { plugins: [createTestVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    wrapper.findComponent(LeagueLinksDialog).vm.$emit('toggle', 2, false)
    await flushPromises()

    expect(useSnackbar().message.value).toBe(message)
    expect(wrapper.emitted('updated')).toBeUndefined()
  })

  it('vincular a uma liga já sorteada mostra o 422 do back e mantém o vínculo como estava', async () => {
    setupLeagueSession(makeUser('admin', ['team:update']), [
      makeLeague(1, championshipA, { name: 'Série A' }),
      makeLeague(2, championshipA, { name: 'Série B', fixture_mode: 'draw' }),
    ])
    vi.mocked(teamsService.attachLeagues).mockRejectedValue(apiError(422, DRAWN_MESSAGE))
    const team = makeTeam(5, 'Vitória', { leagues: [{ id: 1, name: 'Série A' }] })
    const wrapper = mount(TeamLeaguesDialog, {
      props: { modelValue: true, team },
      global: { plugins: [createTestVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    const links = wrapper.findComponent(LeagueLinksDialog)
    links.vm.$emit('toggle', 2, false)
    await flushPromises()

    expect(teamsService.attachLeagues).toHaveBeenCalledWith(5, [2])
    const snackbar = useSnackbar()
    expect(snackbar.color.value).toBe('error')
    expect(snackbar.message.value).toBe(DRAWN_MESSAGE)
    expect(links.props('linkedIds')).toEqual([1])
    expect(wrapper.emitted('updated')).toBeUndefined()
  })
})
