<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { championshipsService } from '@/services/api/championships.service'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<
  Championship,
  ChampionshipPayload
>(championshipsService)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const championshipToDelete = ref<Championship | null>(null)

const headers = [
  { title: 'Imagem', key: 'image', sortable: false },
  { title: 'Nome', key: 'name' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

function askDelete(championship: Championship) {
  championshipToDelete.value = championship
  confirmDialog.value = true
}

async function handleDelete() {
  if (!championshipToDelete.value) return
  const ok = await destroy(championshipToDelete.value.id)
  if (ok) {
    snackbar.success('Campeonato excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o campeonato.')
  }
  championshipToDelete.value = null
}

onMounted(fetchAll)
</script>

<template>
  <div>
    <!-- Gestão de campeonatos fica fora do contexto de liga (sem nav rail): volta para a seleção. -->
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-2"
      :to="{ name: 'admin-select-championship' }"
    >
      Seleção de liga
    </v-btn>

    <PageHeader title="Campeonatos">
      <template #action>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-championships-create' }">
          Novo Campeonato
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
          <template v-slot:[`item.image`]="{ item }">
            <ChampionshipImage :src="item.image" width="40" height="40" rounded="lg">
              <v-avatar
                size="40"
                rounded="lg"
                color="grey-lighten-3"
                data-test="championship-image-fallback"
              >
                <v-icon icon="mdi-trophy-outline" />
              </v-avatar>
            </ChampionshipImage>
          </template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-championships-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir campeonato"
      :message="`Tem certeza que deseja excluir '${championshipToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
