<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { championshipsService } from '@/services/api/championships.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { Championship, ChampionshipPayload, League } from '@/types/championship'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PasswordDeleteDialog from '@/components/common/PasswordDeleteDialog.vue'

const { items, loading, errorMessage, fetchAll } = useCrud<Championship, ChampionshipPayload>(
  championshipsService,
)
const snackbar = useSnackbar()
const leagueContext = useLeagueContextStore()

const search = ref('')
const deleteDialog = ref(false)
const championshipToDelete = ref<Championship | null>(null)
const leaguesToDelete = ref<League[]>([])
const loadingLeagues = ref(false)

const CHAMPIONSHIP_REMOVED = [
  'partidas e súmulas das ligas',
  'estádios das ligas',
  'vínculos dos times e dos usuários com as ligas',
  'a imagem do campeonato',
]

const leaguesSummary = computed(() => {
  const names = leaguesToDelete.value.map((league) => league.name).join(', ')
  if (leaguesToDelete.value.length === 0) return 'Nenhuma liga neste campeonato.'
  if (leaguesToDelete.value.length === 1) return `Será apagada 1 liga: ${names}.`
  return `Serão apagadas ${leaguesToDelete.value.length} ligas: ${names}.`
})

const headers = [
  { title: 'Imagem', key: 'image', sortable: false },
  { title: 'Nome', key: 'name' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

async function askDelete(championship: Championship) {
  championshipToDelete.value = championship
  leaguesToDelete.value = []
  loadingLeagues.value = true
  deleteDialog.value = true
  try {
    const { leagues } = await championshipsService.get(championship.id)
    if (championshipToDelete.value?.id === championship.id) leaguesToDelete.value = leagues ?? []
  } catch {
    if (championshipToDelete.value?.id !== championship.id) return
    deleteDialog.value = false
    snackbar.error('Não foi possível carregar o campeonato.')
  } finally {
    if (championshipToDelete.value?.id === championship.id) loadingLeagues.value = false
  }
}

async function deleteChampionship(password: string) {
  if (championshipToDelete.value) {
    await championshipsService.removeWithPassword(championshipToDelete.value.id, password)
  }
}

function onChampionshipDeleted() {
  const ids = leaguesToDelete.value.map((league) => league.id)
  if (leagueContext.activeLeagueId !== null && ids.includes(leagueContext.activeLeagueId)) {
    leagueContext.clearActiveLeague()
  }
  leagueContext.loadLeagues(true).catch(() => undefined)
  snackbar.success('Campeonato excluído com sucesso.')
  fetchAll()
}

onMounted(fetchAll)
</script>

<template>
  <div>
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
                color="surface-variant"
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
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              aria-label="Excluir campeonato"
              data-test="championship-delete"
              @click="askDelete(item)"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <PasswordDeleteDialog
      v-model="deleteDialog"
      :title="`Excluir campeonato ${championshipToDelete?.name ?? ''}`"
      confirm-text="Excluir campeonato"
      :removed="CHAMPIONSHIP_REMOVED"
      kept="Times, jogadores, comissão técnica e usuários continuam no sistema."
      :request="deleteChampionship"
      :loading="loadingLeagues"
      @deleted="onChampionshipDeleted"
    >
      <v-progress-linear v-if="loadingLeagues" indeterminate color="error" class="mb-4" />
      <p v-else class="mb-4 font-weight-medium" data-test="championship-delete-leagues">
        {{ leaguesSummary }}
      </p>
    </PasswordDeleteDialog>
  </div>
</template>
