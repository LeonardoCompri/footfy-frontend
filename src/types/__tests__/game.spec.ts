import { describe, expect, it } from 'vitest'
import { makeGame } from '@/test/factories'
import { compareGamesForListing } from '@/types/game'

describe('compareGamesForListing', () => {
  const ids = (games: ReturnType<typeof makeGame>[]) =>
    [...games].sort(compareGamesForListing).map((game) => game.id)

  it('põe as rodadas em ordem e as fases depois, por phase_order', () => {
    const games = [
      makeGame(1, { round: null, phase: 'Final', phase_order: 2 }),
      makeGame(2, { round: 2 }),
      makeGame(3, { round: null, phase: 'Semifinal', phase_order: 1 }),
      makeGame(4, { round: 1 }),
    ]

    expect(ids(games)).toEqual([4, 2, 3, 1])
  })

  it('phase_order nulo vai depois das fases ordenadas', () => {
    const games = [
      makeGame(1, { round: null, phase: 'Amistoso', phase_order: null }),
      makeGame(2, { round: null, phase: 'Final', phase_order: 2 }),
      makeGame(3, { round: 1 }),
      makeGame(4, { round: null, phase: 'Semifinal', phase_order: 1 }),
    ]

    expect(ids(games)).toEqual([3, 4, 2, 1])
  })

  it('na mesma etapa desempata pela data, com data nula primeiro como no MySQL, e depois pelo id', () => {
    const games = [
      makeGame(5, { round: 1, match_date: '2026-03-08 18:00:00' }),
      makeGame(4, { round: 1, match_date: '2026-03-08 16:00:00' }),
      makeGame(3, { round: 1, match_date: null }),
      makeGame(2, { round: 1, match_date: '2026-03-08 16:00:00' }),
      makeGame(1, { round: 1, match_date: null }),
    ]

    expect(ids(games)).toEqual([1, 3, 2, 4, 5])
  })
})
