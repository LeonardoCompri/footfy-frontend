export function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return date
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

export function formatBirthDate(date: string | null, today = new Date()): string {
  if (!date) return '—'
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return date
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--
  return `${formatDate(date)} (${age} anos)`
}

export function cpfDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value: string | null | undefined): string {
  return cpfDigits(value)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}
