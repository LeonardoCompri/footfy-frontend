import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AuditLogDetailDialog from '@/components/audit/AuditLogDetailDialog.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import { formatDateTime } from '@/components/common/format'
import { createTestVuetify } from '@/test/utils'
import { makeAuditLog } from '@/test/factories'
import type { AuditLog } from '@/types/auditLog'

function mountDialog(log: AuditLog) {
  return mount(AuditLogDetailDialog, {
    props: { modelValue: true, log },
    global: { plugins: [createTestVuetify()] },
    attachTo: document.body,
  })
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

function dialog() {
  return document.querySelector(
    '.v-dialog.v-overlay--active [data-test="audit-detail"]',
  ) as HTMLElement
}

function texts(selector: string) {
  return Array.from(dialog().querySelectorAll(selector)).map((el) => el.textContent?.trim())
}

describe('AuditLogDetailDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.innerWidth = 1366
  })

  afterEach(() => {
    setClipboard(undefined)
  })

  it('mostra ação, resumo e o diff campo a campo (antes × depois)', async () => {
    mountDialog(
      makeAuditLog(1, {
        action: 'league.updated',
        old_values: { name: 'Série A', season: '2025', team_ids: [1, 2] },
        new_values: { name: 'Série A', season: '2026', team_ids: [1, 2, 3] },
      }),
    )
    await flushPromises()

    expect(dialog().textContent).toContain('Liga editada')
    expect(dialog().querySelector('[data-test="audit-detail-action"]')?.textContent).toBe(
      'league.updated',
    )
    const summary = dialog().querySelector('[data-test="audit-detail-summary"]')!.textContent
    expect(summary).toContain(formatDateTime('2026-11-17T15:00:00.000000Z'))
    expect(summary).toContain('Ana Master')
    expect(summary).toContain('Liga #1')
    expect(summary).toContain('Copa Footfy')
    expect(summary).toContain('Série A')

    expect(texts('[data-test="audit-diff-field"]')).toEqual(['name', 'season', 'team_ids'])
    expect(texts('[data-test="audit-diff-before"]')).toEqual(['Série A', '2025', '[\n  1,\n  2\n]'])
    expect(texts('[data-test="audit-diff-after"]')).toEqual([
      'Série A',
      '2026',
      '[\n  1,\n  2,\n  3\n]',
    ])
    const after = dialog().querySelectorAll('[data-test="audit-diff-after"]')
    expect(after[0].classList).not.toContain('font-weight-bold')
    expect(after[1].classList).toContain('font-weight-bold')
  })

  it('usuário excluído, sistema, liga excluída, meta em JSON e sem valores', async () => {
    mountDialog(
      makeAuditLog(2, {
        action: 'draw.reset',
        user: { id: 9, name: null },
        league: { id: 7, name: null },
        championship: null,
        old_values: null,
        new_values: null,
        meta: { round: 3, removed_games: 4 },
        ip: null,
        user_agent: null,
      }),
    )
    await flushPromises()

    const summary = dialog().querySelector('[data-test="audit-detail-summary"]')!.textContent
    expect(summary).toContain('Usuário #9 (excluído)')
    expect(summary).toContain('Liga #7 (excluída)')
    expect(dialog().querySelector('[data-test="audit-diff-empty"]')).not.toBeNull()
    expect(dialog().querySelector('[data-test="audit-meta"]')?.textContent).toBe(
      '{\n  "round": 3,\n  "removed_games": 4\n}',
    )
    expect(dialog().querySelector('[data-test="audit-ip"]')?.textContent).toBe('—')
  })

  it('ação gravada pelo sistema mostra "Sistema"', async () => {
    mountDialog(makeAuditLog(3, { user: null }))
    await flushPromises()
    expect(dialog().querySelector('[data-test="audit-detail-summary"]')!.textContent).toContain(
      'Sistema',
    )
  })

  it('copia o request_id para a área de transferência e avisa', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    mountDialog(makeAuditLog(4, { request_id: 'abc-123' }))
    await flushPromises()

    expect(dialog().querySelector('[data-test="audit-request-id"]')?.textContent).toBe('abc-123')
    ;(dialog().querySelector('[data-test="audit-copy-request-id"]') as HTMLElement).click()
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('abc-123')
    expect(useSnackbar().message.value).toBe('ID da requisição copiado.')
    expect(useSnackbar().color.value).toBe('success')
  })

  it('sem clipboard disponível avisa o erro; sem request_id não há botão de copiar', async () => {
    setClipboard(undefined)
    const wrapper = mountDialog(makeAuditLog(5))
    await flushPromises()
    ;(dialog().querySelector('[data-test="audit-copy-request-id"]') as HTMLElement).click()
    await flushPromises()
    expect(useSnackbar().color.value).toBe('error')

    await wrapper.setProps({ log: makeAuditLog(6, { request_id: null }) })
    await flushPromises()
    expect(dialog().querySelector('[data-test="audit-copy-request-id"]')).toBeNull()
    expect(dialog().querySelector('[data-test="audit-request-id"]')?.textContent).toBe('—')
  })

  it('no celular abre em tela cheia e mostra os rótulos Antes/Depois em cada campo', async () => {
    window.innerWidth = 375
    mountDialog(makeAuditLog(7))
    await flushPromises()

    expect(document.querySelector('.v-dialog.v-overlay--active')?.classList).toContain(
      'v-dialog--fullscreen',
    )
    const row = dialog().querySelector('[data-test="audit-diff-row"]')!
    expect(row.textContent).toContain('Antes')
    expect(row.textContent).toContain('Depois')
  })
})
