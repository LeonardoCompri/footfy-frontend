import http from './http'
import { createResourceService, unwrap } from './resource'
import type { Championship, ChampionshipPayload } from '@/types/championship'

const baseUrl = '/championships'

function toFormData(payload: ChampionshipPayload): FormData {
  const formData = new FormData()
  formData.append('name', payload.name)
  if (payload.image) {
    formData.append('image', payload.image)
  }
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
