export interface TechnicalCommitteeMember {
  id: number
  team_id: number | null
  name: string
  role: string
  birth_date: string | null
  created_at: string
  updated_at: string
}

export type TechnicalCommitteeMemberPayload = Pick<
  TechnicalCommitteeMember,
  'team_id' | 'name' | 'role' | 'birth_date'
>
