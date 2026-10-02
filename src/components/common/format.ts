// Datas `YYYY-MM-DD` do backend: monta à mão para não sofrer deslocamento de fuso
// (new Date('2000-01-01') é meia-noite UTC e vira 31/12 no Brasil).
export function formatBirthDate(date: string | null, today = new Date()): string {
  if (!date) return '—'
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return date
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--
  const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  return `${formatted} (${age} anos)`
}
