import { describe, expect, it } from 'vitest'
import { cpfDigits, formatBirthDate, formatCpf, formatDate } from '@/components/common/format'

describe('formatDate', () => {
  it('formata YYYY-MM-DD sem deslocamento de fuso', () => {
    expect(formatDate('1980-05-10')).toBe('10/05/1980')
    expect(formatDate('2000-01-01T00:00:00.000000Z')).toBe('01/01/2000')
    expect(formatDate(null)).toBe('—')
  })
})

describe('formatBirthDate', () => {
  it('formata sem deslocamento de fuso e calcula a idade', () => {
    const today = new Date(2026, 9, 2)
    expect(formatBirthDate('2000-10-02', today)).toBe('02/10/2000 (26 anos)')
    expect(formatBirthDate('2000-10-03', today)).toBe('03/10/2000 (25 anos)')
    expect(formatBirthDate(null, today)).toBe('—')
  })
})

describe('cpfDigits', () => {
  it('mantém só os dígitos, limitado a 11', () => {
    expect(cpfDigits('123.456.789-01')).toBe('12345678901')
    expect(cpfDigits('CPF: 123.456.789-01 ')).toBe('12345678901')
    expect(cpfDigits('1234567890123')).toBe('12345678901')
    expect(cpfDigits(null)).toBe('')
  })
})

describe('formatCpf', () => {
  it('aplica a máscara de forma progressiva', () => {
    expect(formatCpf('')).toBe('')
    expect(formatCpf('123')).toBe('123')
    expect(formatCpf('1234')).toBe('123.4')
    expect(formatCpf('123456')).toBe('123.456')
    expect(formatCpf('1234567')).toBe('123.456.7')
    expect(formatCpf('123456789')).toBe('123.456.789')
    expect(formatCpf('1234567890')).toBe('123.456.789-0')
    expect(formatCpf('12345678901')).toBe('123.456.789-01')
  })

  it('normaliza CPF já formatado, com lixo ou com dígitos a mais', () => {
    expect(formatCpf('123.456.789-01')).toBe('123.456.789-01')
    expect(formatCpf('123a456b789c01')).toBe('123.456.789-01')
    expect(formatCpf('123456789012')).toBe('123.456.789-01')
    expect(formatCpf(null)).toBe('')
  })
})
