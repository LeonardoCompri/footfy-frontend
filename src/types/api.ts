export interface ApiErrorResponse {
  message: string
  errors?: Record<string, string[]>
}

// Opções de select servidas pelo backend (ex.: GET /players/positions).
export interface SelectOption {
  value: string
  title: string
}

export function optionTitle(options: SelectOption[], value: string | null): string {
  if (!value) return '—'
  return options.find((option) => option.value === value)?.title ?? value
}

// Paginação das listagens paginadas (ex.: GET /games): `{ data, meta }`.
export interface PaginationMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}
