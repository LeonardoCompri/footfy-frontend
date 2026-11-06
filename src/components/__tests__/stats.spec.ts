import { describe, expect, it } from 'vitest'
import { cardCounts, playerEventCounts, type EventTypeLookup } from '@/components/teams/stats'
import { defaultEventTypes, makeEvent, makeEventType } from '@/test/factories'

const types = [
  ...defaultEventTypes(),
  makeEventType(5, 'penalty_goal', { counts_for: 'team', allows_assist: true }),
  makeEventType(6, 'second_yellow', { card: 'red' }),
]
const typeOf: EventTypeLookup = (slug) =>
  types.find((type) => type.slug === slug) ?? { counts_for: null, card: null }

describe('playerEventCounts', () => {
  it('conta pelas flags do tipo: gol (counts_for team), assistência e cartões', () => {
    const events = [
      makeEvent(1, { type: 'goal', player_id: 10 }),
      makeEvent(2, { type: 'penalty_goal', player_id: 10, related_player_id: 20 }),
      makeEvent(3, { type: 'own_goal', player_id: 10 }),
      makeEvent(4, { type: 'goal', player_id: 20, related_player_id: 10 }),
      makeEvent(5, { type: 'yellow_card', player_id: 10 }),
      makeEvent(6, { type: 'second_yellow', player_id: 10 }),
      makeEvent(7, { type: 'unknown', player_id: 10, related_player_id: 20 }),
    ]

    expect(playerEventCounts(events, 10, typeOf)).toEqual({
      goals: 2,
      assists: 1,
      yellowCards: 1,
      redCards: 1,
    })
    expect(playerEventCounts(events, 20, typeOf)).toEqual({
      goals: 1,
      assists: 1,
      yellowCards: 0,
      redCards: 0,
    })
  })
})

describe('cardCounts', () => {
  it('soma amarelos e vermelhos pela flag `card`', () => {
    const events = [
      makeEvent(1, { type: 'yellow_card' }),
      makeEvent(2, { type: 'red_card' }),
      makeEvent(3, { type: 'second_yellow' }),
      makeEvent(4, { type: 'goal' }),
    ]
    expect(cardCounts(events, typeOf)).toEqual({ yellow: 1, red: 2 })
  })
})
