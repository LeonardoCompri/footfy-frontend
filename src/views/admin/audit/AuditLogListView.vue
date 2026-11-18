<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useCrud } from '@/composables/useCrud'
import { auditLogsService } from '@/services/api/auditLogs.service'
import { formatDateTime } from '@/components/common/format'
import {
  auditActionLabel,
  auditChampionshipLabel,
  auditEntityLabel,
  auditLeagueLabel,
  auditUserLabel,
} from '@/types/auditLog'
import type { AuditLog, AuditLogFilters, AuditLogListParams } from '@/types/auditLog'
import PageHeader from '@/components/common/PageHeader.vue'
import AuditLogDetailDialog from '@/components/audit/AuditLogDetailDialog.vue'
import AuditLogFiltersForm from '@/components/audit/AuditLogFilters.vue'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

const { smAndDown } = useDisplay()
const { items, meta, loading, errorMessage, fetchPage } = useCrud<AuditLog, never>(auditLogsService)

const filters = ref<AuditLogFilters>({})
const page = ref(1)
const perPage = ref(20)
const detailOpen = ref(false)
const selectedLog = ref<AuditLog | null>(null)

const query = computed<AuditLogListParams>(() => ({
  ...filters.value,
  page: page.value,
  per_page: perPage.value,
}))

const hasFilters = computed(() => Object.keys(filters.value).length > 0)

watch(
  () => JSON.stringify(query.value),
  () => fetchPage(query.value),
  { immediate: true },
)

function applyFilters(next: AuditLogFilters) {
  if (JSON.stringify(next) === JSON.stringify(filters.value) && page.value === 1) {
    fetchPage(query.value)
    return
  }
  filters.value = next
  page.value = 1
}

const rows = computed(() =>
  items.value.map((log) => ({
    ...log,
    date: formatDateTime(log.created_at),
    actionLabel: auditActionLabel(log.action),
    userLabel: auditUserLabel(log.user),
    entityLabel: auditEntityLabel(log),
    leagueLabel: auditLeagueLabel(log.league),
    championshipLabel: auditChampionshipLabel(log.championship),
  })),
)

type AuditRow = (typeof rows.value)[number]

const headers = computed(() => [
  ...(smAndDown.value ? [] : [{ title: 'Data', key: 'date', sortable: false }]),
  { title: 'Ação', key: 'action', sortable: false },
  ...(smAndDown.value
    ? []
    : [
        { title: 'Usuário', key: 'user', sortable: false },
        { title: 'Entidade', key: 'entity', sortable: false },
        { title: 'Liga / Campeonato', key: 'context', sortable: false },
      ]),
  {
    title: '',
    key: 'actions',
    sortable: false,
    align: 'end' as const,
    headerProps: { class: 'px-2' },
    cellProps: { class: 'px-2' },
  },
])

function openDetail(log: AuditLog) {
  selectedLog.value = log
  detailOpen.value = true
}

function onRowClick(_event: Event, row: { item: AuditLog }) {
  openDetail(row.item)
}

function contextLabel(row: AuditRow): string {
  return row.leagueLabel ?? row.championshipLabel ?? '—'
}
</script>

<template>
  <div>
    <PageHeader title="Auditoria" subtitle="Histórico de alterações do sistema" />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4" data-test="audit-error">
      {{ errorMessage }}
    </v-alert>

    <v-card>
      <v-card-text>
        <AuditLogFiltersForm :loading="loading" @search="applyFilters" />
        <v-data-table-server
          v-model:page="page"
          v-model:items-per-page="perPage"
          :headers="headers"
          :items="rows"
          :items-length="meta?.total ?? 0"
          :items-per-page-options="PER_PAGE_OPTIONS"
          :loading="loading"
          item-value="id"
          :no-data-text="
            hasFilters
              ? 'Nenhum registro encontrado com esses filtros.'
              : 'Nenhum registro de auditoria.'
          "
          hover
          data-test="audit-table"
          @click:row="onRowClick"
        >
          <template v-slot:[`item.action`]="{ item }">
            <div class="py-2 min-w-0">
              <div class="font-weight-medium text-break-word">{{ item.actionLabel }}</div>
              <div v-if="smAndDown" class="text-caption text-medium-emphasis text-break-word">
                {{ item.date }} · {{ item.userLabel }}
              </div>
              <div v-if="smAndDown" class="text-caption text-medium-emphasis text-break-word">
                {{ item.entityLabel }} · {{ contextLabel(item) }}
              </div>
            </div>
          </template>
          <template v-slot:[`item.date`]="{ item }">
            <span class="text-no-wrap">{{ item.date }}</span>
          </template>
          <template v-slot:[`item.user`]="{ item }">{{ item.userLabel }}</template>
          <template v-slot:[`item.entity`]="{ item }">{{ item.entityLabel }}</template>
          <template v-slot:[`item.context`]="{ item }">
            <div>{{ contextLabel(item) }}</div>
            <div
              v-if="item.leagueLabel && item.championshipLabel"
              class="text-caption text-medium-emphasis"
            >
              {{ item.championshipLabel }}
            </div>
          </template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-eye-outline"
              variant="text"
              size="small"
              :aria-label="`Ver detalhes: ${item.actionLabel}`"
              data-test="audit-view"
              @click.stop="openDetail(item)"
            />
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <AuditLogDetailDialog v-model="detailOpen" :log="selectedLog" />
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.text-break-word {
  overflow-wrap: anywhere;
}
</style>
