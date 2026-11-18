<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useSnackbar } from '@/composables/useSnackbar'
import { formatDateTime } from '@/components/common/format'
import {
  auditActionLabel,
  auditChampionshipLabel,
  auditEntityLabel,
  auditLeagueLabel,
  auditUserLabel,
} from '@/types/auditLog'
import type { AuditLog } from '@/types/auditLog'
import { auditDiff } from './auditDiff'

const props = defineProps<{
  modelValue: boolean
  log: AuditLog | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { xs } = useDisplay()
const snackbar = useSnackbar()

const summary = computed(() => {
  const log = props.log
  if (!log) return []
  return [
    { label: 'Data', value: formatDateTime(log.created_at) },
    { label: 'Usuário', value: auditUserLabel(log.user) },
    { label: 'Entidade', value: auditEntityLabel(log) },
    { label: 'Campeonato', value: auditChampionshipLabel(log.championship) ?? '—' },
    { label: 'Liga', value: auditLeagueLabel(log.league) ?? '—' },
  ]
})

const diff = computed(() =>
  props.log ? auditDiff(props.log.old_values, props.log.new_values) : [],
)
const meta = computed(() => (props.log?.meta ? JSON.stringify(props.log.meta, null, 2) : null))

async function copyRequestId() {
  const requestId = props.log?.request_id
  if (!requestId) return
  try {
    await navigator.clipboard.writeText(requestId)
    snackbar.success('ID da requisição copiado.')
  } catch {
    snackbar.error('Não foi possível copiar o ID da requisição.')
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    :fullscreen="xs"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="log" data-test="audit-detail">
      <v-card-title class="d-flex align-center ga-2">
        <span class="text-truncate">{{ auditActionLabel(log.action) }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Fechar"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>
      <v-card-subtitle class="text-wrap pb-2">
        <code data-test="audit-detail-action">{{ log.action }}</code>
      </v-card-subtitle>

      <v-card-text>
        <v-row dense data-test="audit-detail-summary">
          <v-col v-for="item in summary" :key="item.label" cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">{{ item.label }}</div>
            <div class="text-break-word">{{ item.value }}</div>
          </v-col>
        </v-row>

        <h3 class="text-subtitle-1 font-weight-bold mt-4 mb-2">Alterações</h3>
        <p v-if="diff.length === 0" class="text-medium-emphasis" data-test="audit-diff-empty">
          Nenhum valor registrado.
        </p>
        <div v-else data-test="audit-diff">
          <v-row dense class="d-none d-sm-flex text-caption text-medium-emphasis font-weight-bold">
            <v-col sm="4">Campo</v-col>
            <v-col sm="4">Antes</v-col>
            <v-col sm="4">Depois</v-col>
          </v-row>
          <v-row
            v-for="row in diff"
            :key="row.field"
            dense
            class="border-t"
            data-test="audit-diff-row"
          >
            <v-col
              cols="12"
              sm="4"
              class="font-weight-medium text-break-word"
              data-test="audit-diff-field"
            >
              {{ row.field }}
            </v-col>
            <v-col cols="6" sm="4">
              <div class="d-sm-none text-caption text-medium-emphasis">Antes</div>
              <pre class="audit-value" data-test="audit-diff-before">{{ row.before }}</pre>
            </v-col>
            <v-col cols="6" sm="4">
              <div class="d-sm-none text-caption text-medium-emphasis">Depois</div>
              <pre
                class="audit-value"
                :class="{ 'font-weight-bold': row.changed }"
                data-test="audit-diff-after"
                >{{ row.after }}</pre
              >
            </v-col>
          </v-row>
        </div>

        <template v-if="meta">
          <h3 class="text-subtitle-1 font-weight-bold mt-4 mb-2">Meta</h3>
          <pre
            class="audit-value audit-block bg-surface-variant rounded pa-3"
            data-test="audit-meta"
            >{{ meta }}</pre
          >
        </template>

        <h3 class="text-subtitle-1 font-weight-bold mt-4 mb-2">Requisição</h3>
        <div class="text-caption text-medium-emphasis">ID da requisição</div>
        <div class="d-flex align-center ga-1 mb-2">
          <code class="text-break-word" data-test="audit-request-id">{{
            log.request_id ?? '—'
          }}</code>
          <v-btn
            v-if="log.request_id"
            icon="mdi-content-copy"
            variant="text"
            size="small"
            aria-label="Copiar ID da requisição"
            data-test="audit-copy-request-id"
            @click="copyRequestId"
          />
        </div>
        <div class="text-caption text-medium-emphasis">IP</div>
        <div class="mb-2" data-test="audit-ip">{{ log.ip ?? '—' }}</div>
        <div class="text-caption text-medium-emphasis">Navegador</div>
        <div class="text-break-word" data-test="audit-user-agent">{{ log.user_agent ?? '—' }}</div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.audit-value {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.audit-block {
  font-family: monospace;
  font-size: 0.8125rem;
}
.text-break-word {
  overflow-wrap: anywhere;
}
</style>
