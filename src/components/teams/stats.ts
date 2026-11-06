import type { Game } from '@/types/game'
import type { EventTypeMeta, GameEvent } from '@/types/gameEvent'

export type EventTypeLookup = (slug: string) => Pick<EventTypeMeta, 'counts_for' | 'card'>

export interface TeamRecord {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

export function teamRecord(games: Game[], teamId: number): TeamRecord {
  const record: TeamRecord = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
  for (const game of games) {
    if (game.status !== 'finished' || game.home_score === null || game.away_score === null) continue
    const isHome = game.home_team_id === teamId
    if (!isHome && game.away_team_id !== teamId) continue
    const scored = isHome ? game.home_score : game.away_score
    const conceded = isHome ? game.away_score : game.home_score
    record.played++
    record.goalsFor += scored
    record.goalsAgainst += conceded
    if (scored > conceded) record.wins++
    else if (scored === conceded) record.draws++
    else record.losses++
  }
  return record
}

export interface PlayerEventCounts {
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}

export function playerEventCounts(
  events: GameEvent[],
  playerId: number,
  typeOf: EventTypeLookup,
): PlayerEventCounts {
  const counts: PlayerEventCounts = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
  for (const event of events) {
    const type = typeOf(event.type)
    const isGoal = type.counts_for === 'team'
    if (isGoal && event.related_player_id === playerId) counts.assists++
    if (event.player_id !== playerId) continue
    if (isGoal) counts.goals++
    if (type.card === 'yellow') counts.yellowCards++
    else if (type.card === 'red') counts.redCards++
  }
  return counts
}

export function cardCounts(events: GameEvent[], typeOf: EventTypeLookup) {
  const counts = { yellow: 0, red: 0 }
  for (const event of events) {
    const card = typeOf(event.type).card
    if (card) counts[card]++
  }
  return counts
}
