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
  }
  // Multipart não tem null: opcional vazio vai como '' e o backend converte para null.
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
  // Laravel não faz parse de multipart/form-data em requisições PUT, então usamos
  // POST com o override `_method=PUT` para permitir o upload de imagem na edição.
  update: (id: number | string, payload: ChampionshipPayload) =>
    unwrap<Championship>(http.post(`${baseUrl}/${id}?_method=PUT`, toFormData(payload))),
}
