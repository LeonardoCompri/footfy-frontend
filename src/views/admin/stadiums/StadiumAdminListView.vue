<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { stadiumsService } from '@/services/api/stadiums.service'
import type { Stadium, StadiumPayload } from '@/types/stadium'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<Stadium, StadiumPayload>(
  stadiumsService,
)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const stadiumToDelete = ref<Stadium | null>(null)

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Cidade', key: 'city' },
  { title: 'Capacidade', key: 'capacity' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

function askDelete(stadium: Stadium) {
  stadiumToDelete.value = stadium
  confirmDialog.value = true
}

async function handleDelete() {
  if (!stadiumToDelete.value) return
  const ok = await destroy(stadiumToDelete.value.id)
  if (ok) {
    snackbar.success('Estádio excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o estádio.')
  }
  stadiumToDelete.value = null
}

onMounted(fetchAll)
</script>

<template>
  <div>
    <PageHeader title="Estádios">
      <template #action>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-stadiums-create' }">
          Novo Estádio
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
        <v-data-table :headers="headers" :items="items" :search="search" :loading="loading" item-value="id">
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-stadiums-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir estádio"
      :message="`Tem certeza que deseja excluir '${stadiumToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
