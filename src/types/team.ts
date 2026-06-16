export interface Team {
  id: number
  name: string
  nickname: string | null
  logo: string | null
  created_at: string
  updated_at: string
}

export type TeamPayload = Pick<Team, 'name' | 'nickname' | 'logo'>
