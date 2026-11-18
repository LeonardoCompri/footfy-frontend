import { describe, expect, it } from 'vitest'
import { auditDiff, formatAuditValue } from '@/components/audit/auditDiff'
import {
  auditActionLabel,
  auditChampionshipLabel,
  auditEntityLabel,
  auditLeagueLabel,
  auditUserLabel,
} from '@/types/auditLog'
import { formatDateTime } from '@/components/common/format'
import { makeAuditLog } from '@/test/factories'

describe('auditDiff', () => {
  it('une as chaves de antes e depois em ordem alfabética (o MySQL reordena o JSON)', () => {
    const rows = auditDiff(
      { name: 'Série A', season: '2025', format: 'round_robin' },
      { name: 'Série A', season: '2026', organizer: 'Federação' },
    )

    expect(rows).toEqual([
      { field: 'format', before: 'round_robin', after: '—', changed: true },
      { field: 'name', before: 'Série A', after: 'Série A', changed: false },
      { field: 'organizer', before: '—', after: 'Federação', changed: true },
      { field: 'season', before: '2025', after: '2026', changed: true },
    ])
  })

  it('criação e exclusão: o lado ausente vira "—"', () => {
    expect(auditDiff(null, { name: 'Nova' })).toEqual([
      { field: 'name', before: '—', after: 'Nova', changed: true },
    ])
    expect(auditDiff({ name: 'Velha' }, null)).toEqual([
      { field: 'name', before: 'Velha', after: '—', changed: true },
    ])
    expect(auditDiff(null, null)).toEqual([])
  })

  it('objeto e array viram JSON formatado e entram na comparação pelo conteúdo', () => {
    const rows = auditDiff(
      { team_ids: [1, 2], rules: { a: 1 } },
      { team_ids: [1, 2, 3], rules: { a: 1 } },
    )

    expect(rows[1]).toEqual({
      field: 'team_ids',
      before: '[\n  1,\n  2\n]',
      after: '[\n  1,\n  2,\n  3\n]',
      changed: true,
    })
    expect(rows[0]).toMatchObject({ field: 'rules', before: '{\n  "a": 1\n}', changed: false })
  })

  it.each([
    [null, '—'],
    [undefined, '—'],
    ['', '(vazio)'],
    ['texto', 'texto'],
    [0, '0'],
    [12.5, '12.5'],
    [true, 'Sim'],
    [false, 'Não'],
  ])('formatAuditValue(%s) = %s', (value, expected) => {
    expect(formatAuditValue(value)).toBe(expected)
  })
})

describe('rótulos da auditoria', () => {
  it('ação conhecida em pt-BR e desconhecida mostra o código', () => {
    expect(auditActionLabel('draw.round_undone')).toBe('Rodada desfeita')
    expect(auditActionLabel('game_event.updated')).toBe('Evento de partida editado')
    expect(auditActionLabel('team.created')).toBe('team.created')
  })

  it('usuário: nome, excluído (sem nome) e sistema (null)', () => {
    expect(auditUserLabel({ id: 1, name: 'Fulano' })).toBe('Fulano')
    expect(auditUserLabel({ id: 9, name: null })).toBe('Usuário #9 (excluído)')
    expect(auditUserLabel(null)).toBe('Sistema')
  })

  it('liga e campeonato excluídos mostram o id; ausentes devolvem null', () => {
    expect(auditLeagueLabel({ id: 7, name: null })).toBe('Liga #7 (excluída)')
    expect(auditChampionshipLabel({ id: 4, name: null })).toBe('Campeonato #4 (excluído)')
    expect(auditLeagueLabel(null)).toBeNull()
    expect(auditChampionshipLabel(null)).toBeNull()
  })

  it('entidade com tipo em pt-BR e tipo desconhecido cru', () => {
    expect(auditEntityLabel(makeAuditLog(1, { auditable: { type: 'game_event', id: 5 } }))).toBe(
      'Evento de partida #5',
    )
    expect(auditEntityLabel(makeAuditLog(1, { auditable: { type: 'foo', id: 2 } }))).toBe('foo #2')
  })
})

describe('formatDateTime', () => {
  it('converte o UTC da API para o horário local em pt-BR', () => {
    const iso = '2026-11-17T15:00:00.000000Z'
    const local = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(formatDateTime(iso)).toBe(
      `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()} ` +
        `${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`,
    )
  })

  it('vazio vira "—" e valor inválido volta cru', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('ontem')).toBe('ontem')
  })
})
