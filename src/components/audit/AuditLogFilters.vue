<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { AUDIT_ACTION_OPTIONS, AUDITABLE_TYPE_OPTIONS, auditActionCode } from '@/types/auditLog'
import type { AuditableType, AuditLogFilters } from '@/types/auditLog'
import AuditUserFilter from './AuditUserFilter.vue'

interface FilterForm {
  from: string | null
  to: string | null
  user_id: number | null
  action: string | null
  championship_id: number | null
  league_id: number | null
  auditable_type: AuditableType | null
  auditable_id: string | number | null
}

defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  search: [filters: AuditLogFilters]
}>()

const { xs } = useDisplay()
const leagueContext = useLeagueContextStore()

const emptyForm = (): FilterForm => ({
  from: null,
  to: null,
  user_id: null,
  action: null,
  championship_id: null,
  league_id: null,
  auditable_type: null,
  auditable_id: null,
})

const form = ref<FilterForm>(emptyForm())
const periodError = ref<string | null>(null)
const idError = ref<string | null>(null)
const actionMenu = ref(false)

const championshipOptions = computed(() =>
  leagueContext.championships.map(({ championship }) => ({
    value: championship.id,
    title: championship.name,
  })),
)

const leagueOptions = computed(() =>
  leagueContext.championships
    .filter(
      ({ championship }) =>
        !form.value.championship_id || championship.id === form.value.championship_id,
    )
    .flatMap(({ championship, leagues }) =>
      leagues.map((league) => ({
        value: league.id,
        title: league.name,
        subtitle: championship.name,
      })),
    ),
)

function onChampionshipChange() {
  if (!leagueOptions.value.some((option) => option.value === form.value.league_id)) {
    form.value.league_id = null
  }
}

function onTypeChange() {
  if (!form.value.auditable_type) {
    form.value.auditable_id = null
    idError.value = null
  }
}

function isPositiveInt(value: string | number): boolean {
  return /^[1-9]\d*$/.test(String(value).trim())
}

function validate(): boolean {
  const { from, to, auditable_id } = form.value
  periodError.value =
    from && to && to < from ? 'A data final deve ser igual ou posterior à inicial.' : null
  idError.value =
    auditable_id !== null && auditable_id !== '' && !isPositiveInt(auditable_id)
      ? 'Informe um número inteiro a partir de 1.'
      : null
  return !periodError.value && !idError.value
}

function toFilters(): AuditLogFilters {
  const { from, to, user_id, action, championship_id, league_id, auditable_type, auditable_id } =
    form.value
  const filters: AuditLogFilters = {}
  if (from) filters.from = from
  if (to) filters.to = to
  if (user_id) filters.user_id = user_id
  if (action?.trim()) filters.action = auditActionCode(action)
  if (championship_id) filters.championship_id = championship_id
  if (league_id) filters.league_id = league_id
  if (auditable_type) filters.auditable_type = auditable_type
  if (auditable_type && auditable_id !== null && auditable_id !== '') {
    filters.auditable_id = Number(auditable_id)
  }
  return filters
}

function search() {
  if (validate()) emit('search', toFilters())
}

async function onActionEnter() {
  await nextTick()
  actionMenu.value = false
  search()
}

function clear() {
  form.value = emptyForm()
  periodError.value = null
  idError.value = null
  emit('search', {})
}

onMounted(() => {
  leagueContext.loadLeagues().catch(() => undefined)
})
</script>

<template>
  <v-row dense class="mb-2" data-test="audit-filters">
    <v-col cols="6" sm="3">
      <v-text-field
        v-model="form.from"
        type="date"
        label="De"
        hide-details="auto"
        :error-messages="periodError ?? undefined"
        data-test="audit-from"
      />
    </v-col>
    <v-col cols="6" sm="3">
      <v-text-field
        v-model="form.to"
        type="date"
        label="Até"
        hide-details="auto"
        :error-messages="periodError ?? undefined"
        data-test="audit-to"
      />
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <AuditUserFilter v-model="form.user_id" data-test="audit-user" />
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-combobox
        v-model="form.action"
        v-model:menu="actionMenu"
        :items="AUDIT_ACTION_OPTIONS"
        :return-object="false"
        label="Ação"
        hide-details
        clearable
        data-test="audit-action"
        @keydown.enter="onActionEnter"
      />
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-autocomplete
        v-model="form.championship_id"
        :items="championshipOptions"
        label="Campeonato"
        hide-details
        clearable
        data-test="audit-championship"
        @update:model-value="onChampionshipChange"
      />
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-autocomplete
        v-model="form.league_id"
        :items="leagueOptions"
        :item-props="true"
        label="Liga"
        hide-details
        clearable
        data-test="audit-league"
      />
    </v-col>
    <v-col cols="7" sm="3" md="3">
      <v-select
        v-model="form.auditable_type"
        :items="AUDITABLE_TYPE_OPTIONS"
        label="Entidade"
        hide-details
        clearable
        data-test="audit-type"
        @update:model-value="onTypeChange"
      />
    </v-col>
    <v-col cols="5" sm="3" md="3">
      <v-text-field
        v-model="form.auditable_id"
        type="number"
        min="1"
        label="ID"
        hide-details="auto"
        :disabled="!form.auditable_type"
        :error-messages="idError ?? undefined"
        data-test="audit-entity-id"
        @keyup.enter="search"
      />
    </v-col>
    <v-col cols="12" class="d-flex flex-wrap justify-end ga-2">
      <v-btn variant="text" :block="xs" data-test="audit-clear" @click="clear">Limpar</v-btn>
      <v-btn
        color="primary"
        prepend-icon="mdi-magnify"
        :block="xs"
        :loading="loading"
        data-test="audit-search"
        @click="search"
      >
        Buscar
      </v-btn>
    </v-col>
  </v-row>
</template>
