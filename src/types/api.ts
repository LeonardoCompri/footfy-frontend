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
