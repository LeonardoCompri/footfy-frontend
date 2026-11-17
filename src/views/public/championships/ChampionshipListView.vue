<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useLoadMore } from '@/composables/useLoadMore'
import { publicChampionshipsService } from '@/services/api/publicChampionships.service'
import type { Championship, ChampionshipFilters } from '@/types/championship'
import ChampionshipCard from '@/components/championships/ChampionshipCard.vue'

const PER_PAGE = 12
const SEARCH_DELAY = 400

const { items, loading, loadingMore, errorMessage, hasMore, reset, loadMore } = useLoadMore<
  Championship,
  ChampionshipFilters
>(publicChampionshipsService.listPaginated, PER_PAGE)

const { xs } = useDisplay()
const search = ref<string | null>('')
const searchedTerm = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

function currentTerm(): string {
  return search.value?.trim() ?? ''
}

function fetchFirstPage() {
  searchedTerm.value = currentTerm()
  return reset(searchedTerm.value ? { search: searchedTerm.value } : {})
}

watch(search, () => {
  clearTimeout(searchTimer)
  if (currentTerm() === searchedTerm.value) return
  searchTimer = setTimeout(fetchFirstPage, SEARCH_DELAY)
})

onMounted(fetchFirstPage)
onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 font-weight-bold mb-6">Campeonatos</h1>

    <v-text-field
      v-model="search"
      label="Buscar campeonato"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="comfortable"
      clearable
      hide-details
      class="mb-6"
      data-test="championships-search"
    />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-row v-if="loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>

    <v-row v-else-if="items.length === 0 && !errorMessage">
      <v-col cols="12">
        <v-alert type="info" variant="tonal" data-test="championships-empty">
          {{
            searchedTerm
              ? 'Nenhum campeonato encontrado para essa busca.'
              : 'Nenhum campeonato cadastrado ainda.'
          }}
        </v-alert>
      </v-col>
    </v-row>

    <template v-else>
      <v-row>
        <v-col v-for="championship in items" :key="championship.id" cols="12" sm="6" md="4">
          <ChampionshipCard :championship="championship" />
        </v-col>
      </v-row>

      <div v-if="hasMore" class="d-flex justify-center mt-6">
        <v-btn
          variant="tonal"
          color="primary"
          :loading="loadingMore"
          :block="xs"
          data-test="championships-load-more"
          @click="loadMore"
        >
          Carregar mais
        </v-btn>
      </div>
    </template>
  </v-container>
</template>
