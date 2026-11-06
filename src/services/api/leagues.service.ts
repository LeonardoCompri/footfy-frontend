import http from './http'
import { createResourceService, unwrap } from './resource'
import type { League, LeaguePayload } from '@/types/championship'
import type { LeagueDashboard } from '@/types/dashboard'
import type { DrawNextRoundPayload, LeagueDrawState } from '@/types/leagueDraw'
import type {
  KnockoutNextStagePayload,
  KnockoutPreview,
  KnockoutStepKey,
  LeagueKnockoutState,
} from '@/types/leagueKnockout'
import type { GroupAssignment, LeagueGroups, LeagueRules } from '@/types/leagueRules'
import type { LeagueStatistics, LeagueTable } from '@/types/leagueStats'

const baseUrl = '/leagues'

export const leaguesService = {
  ...createResourceService<League, LeaguePayload | LeagueRules>(baseUrl),
  dashboard: (id: number | string) => unwrap<LeagueDashboard>(http.get(`${baseUrl}/${id}/dashboard`)),
  table: (id: number | string) => unwrap<LeagueTable>(http.get(`${baseUrl}/${id}/table`)),
  statistics: (id: number | string) => unwrap<LeagueStatistics>(http.get(`${baseUrl}/${id}/statistics`)),
  groups: (id: number | string) => unwrap<LeagueGroups>(http.get(`${baseUrl}/${id}/groups`)),
  saveGroups: (id: number | string, groups: GroupAssignment[]) =>
    unwrap<LeagueGroups>(http.put(`${baseUrl}/${id}/groups`, { groups })),
  shuffleGroups: (id: number | string) =>
    unwrap<LeagueGroups>(http.post(`${baseUrl}/${id}/groups/shuffle`)),
  draw: (id: number | string) => unwrap<LeagueDrawState>(http.get(`${baseUrl}/${id}/draw`)),
  drawNextRound: (id: number | string, payload: DrawNextRoundPayload) =>
    unwrap<LeagueDrawState>(http.post(`${baseUrl}/${id}/draw/next-round`, payload)),
  undoLastRound: (id: number | string, round: number) =>
    unwrap<LeagueDrawState>(http.delete(`${baseUrl}/${id}/draw/last-round`, { data: { round } })),
  resetDraw: (id: number | string) => unwrap<LeagueDrawState>(http.delete(`${baseUrl}/${id}/draw`)),
  knockout: (id: number | string) =>
    unwrap<LeagueKnockoutState>(http.get(`${baseUrl}/${id}/knockout`)),
  knockoutPreview: (id: number | string) =>
    unwrap<KnockoutPreview>(http.get(`${baseUrl}/${id}/knockout/preview`)),
  knockoutNextStage: (id: number | string, payload: KnockoutNextStagePayload) =>
    unwrap<LeagueKnockoutState>(http.post(`${baseUrl}/${id}/knockout/next-stage`, payload)),
  undoKnockoutStage: (id: number | string, stage: KnockoutStepKey) =>
    unwrap<LeagueKnockoutState>(
      http.delete(`${baseUrl}/${id}/knockout/last-stage`, { data: { stage } }),
    ),
  removeWithPassword: (id: number | string, password: string) =>
    http.delete(`${baseUrl}/${id}`, { data: { password } }),
}
