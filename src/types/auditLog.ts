export type AuditableType =
  | 'championship'
  | 'league'
  | 'team'
  | 'game'
  | 'game_event'
  | 'game_event_type'
  | 'player'
  | 'technical_committee_member'
  | 'stadium'
  | 'user'

export interface AuditNamedRef {
  id: number
  name: string | null
}

export interface AuditLog {
  id: number
  action: string
  user: AuditNamedRef | null
  auditable: { type: string; id: number }
  championship: AuditNamedRef | null
  league: AuditNamedRef | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  meta: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  request_id: string | null
  created_at: string
}

export type AuditLogFilters = {
  from?: string
  to?: string
  user_id?: number
  league_id?: number
  championship_id?: number
  action?: string
  auditable_type?: AuditableType
  auditable_id?: number
}

export type AuditLogListParams = AuditLogFilters & {
  page: number
  per_page: number
}

export const AUDITABLE_TYPE_OPTIONS: { value: AuditableType; title: string }[] = [
  { value: 'championship', title: 'Campeonato' },
  { value: 'league', title: 'Liga' },
  { value: 'team', title: 'Time' },
  { value: 'game', title: 'Partida' },
  { value: 'game_event', title: 'Evento de partida' },
  { value: 'game_event_type', title: 'Tipo de evento' },
  { value: 'player', title: 'Jogador' },
  { value: 'technical_committee_member', title: 'Comissão técnica' },
  { value: 'stadium', title: 'Estádio' },
  { value: 'user', title: 'Usuário' },
]

export const AUDIT_ACTION_OPTIONS: { value: string; title: string }[] = [
  { value: 'championship.created', title: 'Campeonato criado' },
  { value: 'championship.updated', title: 'Campeonato editado' },
  { value: 'championship.deleted', title: 'Campeonato excluído' },
  { value: 'league.created', title: 'Liga criada' },
  { value: 'league.updated', title: 'Liga editada' },
  { value: 'league.deleted', title: 'Liga excluída' },
  { value: 'league.teams_attached', title: 'Times vinculados à liga' },
  { value: 'league.teams_detached', title: 'Times desvinculados da liga' },
  { value: 'league.groups_updated', title: 'Grupos da liga salvos' },
  { value: 'league.groups_shuffled', title: 'Grupos da liga sorteados' },
  { value: 'draw.round_drawn', title: 'Rodada sorteada' },
  { value: 'draw.round_undone', title: 'Rodada desfeita' },
  { value: 'draw.reset', title: 'Sorteio reiniciado' },
  { value: 'knockout.stage_generated', title: 'Fase do mata-mata gerada' },
  { value: 'knockout.stage_undone', title: 'Fase do mata-mata desfeita' },
  { value: 'game.updated', title: 'Partida editada' },
  { value: 'game.deleted', title: 'Partida excluída' },
  { value: 'game.penalty_kicks_updated', title: 'Pênaltis da partida salvos' },
  { value: 'game_event.created', title: 'Evento de partida criado' },
  { value: 'game_event.updated', title: 'Evento de partida editado' },
  { value: 'game_event.deleted', title: 'Evento de partida excluído' },
  { value: 'player.updated', title: 'Jogador editado' },
  { value: 'player.restored', title: 'Jogador restaurado' },
  { value: 'player.deleted', title: 'Jogador excluído' },
  { value: 'technical_committee_member.deleted', title: 'Membro da comissão técnica excluído' },
  { value: 'stadium.deleted', title: 'Estádio excluído' },
  { value: 'user.created', title: 'Usuário criado' },
  { value: 'user.updated', title: 'Usuário editado' },
  { value: 'user.deleted', title: 'Usuário excluído' },
  { value: 'user.leagues_attached', title: 'Ligas vinculadas ao usuário' },
  { value: 'user.leagues_detached', title: 'Ligas desvinculadas do usuário' },
  { value: 'game_event_type.created', title: 'Tipo de evento criado' },
  { value: 'game_event_type.updated', title: 'Tipo de evento editado' },
  { value: 'game_event_type.deleted', title: 'Tipo de evento excluído' },
  { value: 'audit_logs.exported', title: 'Auditoria exportada' },
]

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_OPTIONS.find((option) => option.value === action)?.title ?? action
}

export function auditActionCode(text: string): string {
  const typed = text.trim()
  const key = typed.toLocaleLowerCase('pt-BR')
  const option = AUDIT_ACTION_OPTIONS.find(
    ({ value, title }) =>
      value.toLocaleLowerCase('pt-BR') === key || title.toLocaleLowerCase('pt-BR') === key,
  )
  return option?.value ?? typed
}

export function auditableTypeLabel(type: string): string {
  return AUDITABLE_TYPE_OPTIONS.find((option) => option.value === type)?.title ?? type
}

export function auditEntityLabel(log: AuditLog): string {
  return `${auditableTypeLabel(log.auditable.type)} #${log.auditable.id}`
}

export function auditUserLabel(user: AuditNamedRef | null): string {
  if (!user) return 'Sistema'
  return user.name ?? `Usuário #${user.id} (excluído)`
}

export function auditLeagueLabel(league: AuditNamedRef | null): string | null {
  if (!league) return null
  return league.name ?? `Liga #${league.id} (excluída)`
}

export function auditChampionshipLabel(championship: AuditNamedRef | null): string | null {
  if (!championship) return null
  return championship.name ?? `Campeonato #${championship.id} (excluído)`
}
