import http from './http'
import { createResourceService, unwrap } from './resource'
import type { Team, TeamPayload } from '@/types/team'

const baseUrl = '/teams'

function toFormData(payload: TeamPayload): FormData {
  const formData = new FormData()
  formData.append('name', payload.name)
  formData.append('nickname', payload.nickname ?? '')
  if (payload.logo) {
    formData.append('logo', payload.logo)
  }
  payload.league_ids?.forEach((id) => formData.append('league_ids[]', String(id)))
  return formData
}

const base = createResourceService<Team, TeamPayload>(baseUrl)

export const teamsService = {
  ...base,
  create: (payload: TeamPayload) => unwrap<Team>(http.post(baseUrl, toFormData(payload))),
  // Laravel não faz parse de multipart/form-data em PUT: POST com `_method=PUT` (upload do escudo).
  update: (id: number | string, payload: TeamPayload) =>
    unwrap<Team>(
      http.post(`${baseUrl}/${id}?_method=PUT`, toFormData({ ...payload, league_ids: undefined })),
    ),
  attachLeagues: (id: number | string, leagueIds: number[]) =>
    unwrap<Team>(http.post(`${baseUrl}/${id}/leagues`, { league_ids: leagueIds })),
  detachLeague: (id: number | string, leagueId: number | string) =>
    unwrap<Team>(http.delete(`${baseUrl}/${id}/leagues/${leagueId}`)),
}
