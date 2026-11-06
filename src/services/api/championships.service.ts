import http from './http'
import { createResourceService, unwrap } from './resource'
import type { Championship, ChampionshipPayload } from '@/types/championship'

const baseUrl = '/championships'
const LEAGUE_FIELDS = ['name', 'format', 'season', 'organizer', 'start_date', 'end_date'] as const

function toFormData(payload: ChampionshipPayload): FormData {
  const formData = new FormData()
  formData.append('name', payload.name)
  if (payload.image) {
    formData.append('image', payload.image)
  } else if (payload.removeImage) {
    formData.append('image', '')
  }
  payload.leagues?.forEach((league, index) => {
    if (league.id) formData.append(`leagues[${index}][id]`, String(league.id))
    for (const field of LEAGUE_FIELDS) {
      formData.append(`leagues[${index}][${field}]`, league[field] ?? '')
    }
  })
  return formData
}

const base = createResourceService<Championship, ChampionshipPayload>(baseUrl)

export const championshipsService = {
  ...base,
  create: (payload: ChampionshipPayload) =>
    unwrap<Championship>(http.post(baseUrl, toFormData(payload))),
  update: (id: number | string, payload: ChampionshipPayload) =>
    unwrap<Championship>(http.post(`${baseUrl}/${id}?_method=PUT`, toFormData(payload))),
  removeWithPassword: (id: number | string, password: string) =>
    http.delete(`${baseUrl}/${id}`, { data: { password } }),
}
