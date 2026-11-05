import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/api/http'
import { championshipsService } from '@/services/api/championships.service'
import { leaguesService } from '@/services/api/leagues.service'

vi.mock('@/services/api/http', () => ({
  default: { post: vi.fn(), delete: vi.fn() },
}))

function sentFormData(): FormData {
  return vi.mocked(http.post).mock.calls[0]![1] as FormData
}

describe('championshipsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(http.post).mockResolvedValue({ data: { data: { id: 5, name: 'Copa', image: null } } })
  })

  it('create envia as ligas aninhadas no multipart, com opcional vazio como ""', async () => {
    await championshipsService.create({
      name: 'Copa',
      image: null,
      leagues: [
        {
          name: 'Série A',
          format: 'knockout',
          season: '2026',
          organizer: null,
          start_date: '2026-03-01',
          end_date: null,
        },
      ],
    })

    expect(http.post).toHaveBeenCalledWith('/championships', expect.any(FormData))
    const data = sentFormData()
    expect(data.get('name')).toBe('Copa')
    expect(data.has('leagues[0][id]')).toBe(false)
    expect(data.get('leagues[0][name]')).toBe('Série A')
    expect(data.get('leagues[0][format]')).toBe('knockout')
    expect(data.get('leagues[0][season]')).toBe('2026')
    expect(data.get('leagues[0][organizer]')).toBe('')
    expect(data.get('leagues[0][start_date]')).toBe('2026-03-01')
    expect(data.get('leagues[0][end_date]')).toBe('')
  })

  it('update usa _method=PUT e manda o id só da liga já salva', async () => {
    const league = { format: null, season: null, organizer: null, start_date: null, end_date: null }
    await championshipsService.update(5, {
      name: 'Copa',
      image: null,
      leagues: [
        { ...league, id: 7, name: 'Série A' },
        { ...league, name: 'Série B' },
      ],
    })

    expect(http.post).toHaveBeenCalledWith('/championships/5?_method=PUT', expect.any(FormData))
    const data = sentFormData()
    expect(data.get('leagues[0][id]')).toBe('7')
    expect(data.get('leagues[0][name]')).toBe('Série A')
    expect(data.get('leagues[0][format]')).toBe('')
    expect(data.has('leagues[1][id]')).toBe(false)
    expect(data.get('leagues[1][name]')).toBe('Série B')
  })

  // BUG-037 (backend): `image` vazio na edição apaga a imagem do campeonato.
  it('update sem arquivo novo não manda o campo image; com arquivo, manda', async () => {
    await championshipsService.update(5, { name: 'Copa', image: null })
    expect(sentFormData().has('image')).toBe(false)

    vi.mocked(http.post).mockClear()
    const file = new File(['x'], 'copa.png', { type: 'image/png' })
    await championshipsService.update(5, { name: 'Copa', image: file })
    expect(sentFormData().get('image')).toBeInstanceOf(File)
  })

  it('sem ligas não manda nenhum campo leagues', async () => {
    await championshipsService.create({ name: 'Copa', image: null, leagues: [] })

    expect([...sentFormData().keys()]).toEqual(['name'])
  })
})

describe('leaguesService.removeWithPassword', () => {
  it('manda a senha no corpo do DELETE', async () => {
    vi.mocked(http.delete).mockResolvedValue({ status: 204 })

    await leaguesService.removeWithPassword(7, 'segredo')

    expect(http.delete).toHaveBeenCalledWith('/leagues/7', { data: { password: 'segredo' } })
  })
})
