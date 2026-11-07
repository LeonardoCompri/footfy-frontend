import type { Player } from '@/types/player'

export type PlayerOption = Pick<Player, 'id' | 'name' | 'number'> & { removed?: boolean }

export function playerTitle(player: PlayerOption): string {
  return player.number != null ? `${player.number} · ${player.name}` : player.name
}

export function filterPlayer(
  value: string,
  query: string,
  item?: { raw: PlayerOption },
): number | boolean {
  const search = query.trim()
  if (/^\d+$/.test(search)) return item?.raw.number === Number(search)
  return value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
}
