// Datas `YYYY-MM-DD` do backend: monta à mão para não sofrer deslocamento de fuso
// (new Date('2000-01-01') é meia-noite UTC e vira 31/12 no Brasil).
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

// CPF: o backend de usuários/jogadores exige só os 11 dígitos (size:11); a máscara é só visual.
export function cpfDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 11)
}

// Máscara progressiva: 123 → 123.4 → 123.456.7 → 123.456.789-0.
export function formatCpf(value: string | null | undefined): string {
  return cpfDigits(value)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}
