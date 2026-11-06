export interface ApiErrorResponse {
  message: string
  errors?: Record<string, string[]>
}

export interface SelectOption {
  value: string
  title: string
}

export function optionTitle(options: SelectOption[], value: string | null): string {
  if (!value) return '—'
  return options.find((option) => option.value === value)?.title ?? value
}

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
