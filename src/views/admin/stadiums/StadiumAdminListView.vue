<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { stadiumsService } from '@/services/api/stadiums.service'
import type { Stadium, StadiumPayload } from '@/types/stadium'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StadiumFormDialog from '@/components/stadiums/StadiumFormDialog.vue'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Stadium, StadiumPayload>(
  stadiumsService,
)

const { xs } = useDisplay()

const leagueId = leagueContext.activeLeagueId as number
const canCreate = authStore.hasPermission('stadium:create')
const canUpdate = authStore.hasPermission('stadium:update')
const canDelete = authStore.hasPermission('stadium:delete')

const search = ref('')
const formDialog = ref(false)
const stadiumToEdit = ref<Stadium | null>(null)
const confirmDialog = ref(false)
const stadiumToDelete = ref<Stadium | null>(null)

const headers = computed(() => [
  { title: 'Nome', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Cidade', key: 'city' }]),
  { title: 'Capacidade', key: 'capacity' },
  ...(canUpdate || canDelete
    ? [{ title: xs.value ? '' : 'Ações', key: 'actions', sortable: false, align: 'end' as const }]
    : []),
])

function openForm(stadium: Stadium | null) {
  stadiumToEdit.value = stadium
  formDialog.value = true
}

function askDelete(stadium: Stadium) {
  stadiumToDelete.value = stadium
  confirmDialog.value = true
}

async function handleDelete() {
  if (!stadiumToDelete.value) return
  if (await destroy(stadiumToDelete.value.id)) {
    snackbar.success('Estádio excluído com sucesso.')
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir o estádio.')
    errorMessage.value = null
  }
  stadiumToDelete.value = null
}

function loadStadiums() {
  return fetchAll({ league_id: leagueId })
}

onMounted(loadStadiums)
</script>

<template>
  <div>
    <PageHeader title="Estádios" :subtitle="leagueContext.activeLeague?.name">
      <template #action>
        <v-btn
          v-if="canCreate"
          color="primary"
          prepend-icon="mdi-plus"
          data-test="stadium-create"
          @click="openForm(null)"
        >
          <span class="d-none d-sm-inline">Novo estádio</span>
          <span class="d-sm-none">Novo</span>
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Buscar"
          single-line
          hide-details
          class="mb-4"
        />
        <v-data-table
          :headers="headers"
          :items="items"
          :search="search"
          :loading="loading"
          item-value="id"
          no-data-text="Nenhum estádio cadastrado nesta liga."
          data-test="stadiums-table"
        >
          <template v-slot:[`item.name`]="{ item }">
            <div>{{ item.name }}</div>
            <div v-if="xs" class="text-caption text-medium-emphasis">{{ item.city }}</div>
          </template>
          <template v-slot:[`item.capacity`]="{ item }">{{ item.capacity.toLocaleString('pt-BR') }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <div class="d-flex justify-end">
              <v-btn
                v-if="canUpdate"
                icon="mdi-pencil"
                variant="text"
                size="small"
                data-test="stadium-edit"
                @click="openForm(item)"
              />
              <v-btn
                v-if="canDelete"
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                data-test="stadium-delete"
                @click="askDelete(item)"
              />
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <StadiumFormDialog
      v-model="formDialog"
      :league-id="leagueId"
      :stadium="stadiumToEdit"
      @saved="loadStadiums"
    />
    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir estádio"
      :message="`Tem certeza que deseja excluir '${stadiumToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
