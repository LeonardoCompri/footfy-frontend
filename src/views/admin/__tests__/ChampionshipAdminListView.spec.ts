import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChampionshipAdminListView from '@/views/admin/championships/ChampionshipAdminListView.vue'
import { championshipsService } from '@/services/api/championships.service'
import { championshipA, createTestRouter, createTestVuetify } from '@/test/utils'

vi.mock('@/services/api/http', () => ({ default: {} }))
vi.mock('@/services/api/championships.service', () => ({
  championshipsService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

describe('ChampionshipAdminListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(championshipsService.list).mockResolvedValue([championshipA])
  })

  it('campeonato sem imagem usa fallback com cor do tema, não cor fixa (BUG-038)', async () => {
    const router = createTestRouter()
    await router.push({ name: 'admin-championships-list' })
    const wrapper = mount(ChampionshipAdminListView, {
      global: { plugins: [createTestVuetify(), router] },
    })
    await flushPromises()

    const fallback = wrapper.find('[data-test="championship-image-fallback"]')
    expect(fallback.exists()).toBe(true)
    expect(fallback.classes()).toContain('bg-surface-variant')
    expect(fallback.classes()).not.toContain('bg-grey-lighten-3')
  })
})
