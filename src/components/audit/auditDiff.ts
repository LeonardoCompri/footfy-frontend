export interface AuditDiffRow {
  field: string
  before: string
  after: string
  changed: boolean
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value === '' ? '(vazio)' : value
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export function auditDiff(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): AuditDiffRow[] {
  const before = oldValues ?? {}
  const after = newValues ?? {}
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
  return fields.map((field) => ({
    field,
    before: formatAuditValue(before[field]),
    after: formatAuditValue(after[field]),
    changed: JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  }))
}
