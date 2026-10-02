import type { Game } from '@/types/game'
import type { GameEvent } from '@/types/gameEvent'

export interface TeamRecord {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

// Campanha do time a partir das partidas finalizadas da liga (vale para qualquer formato).
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

export function playerEventCounts(events: GameEvent[], playerId: number): PlayerEventCounts {
  const counts: PlayerEventCounts = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
  for (const event of events) {
    if (event.type === 'goal' && event.related_player_id === playerId) counts.assists++
    if (event.player_id !== playerId) continue
    if (event.type === 'goal') counts.goals++
    else if (event.type === 'yellow_card') counts.yellowCards++
    else if (event.type === 'red_card') counts.redCards++
  }
  return counts
}
