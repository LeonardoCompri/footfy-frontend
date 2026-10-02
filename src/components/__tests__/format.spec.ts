import { describe, expect, it } from 'vitest'
import { formatBirthDate } from '@/components/common/format'

describe('formatBirthDate', () => {
  it('formata sem deslocamento de fuso e calcula a idade', () => {
    const today = new Date(2026, 9, 2)
    expect(formatBirthDate('2000-10-02', today)).toBe('02/10/2000 (26 anos)')
    expect(formatBirthDate('2000-10-03', today)).toBe('03/10/2000 (25 anos)')
    expect(formatBirthDate(null, today)).toBe('—')
  })
})
