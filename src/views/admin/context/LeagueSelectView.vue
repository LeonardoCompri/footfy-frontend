<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import type { League } from '@/types/championship'
import PageHeader from '@/components/common/PageHeader.vue'

const props = defineProps<{ championshipId: string }>()

const router = useRouter()
const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()

const group = computed(() =>
  leagueContext.championships.find((g) => g.championship.id === Number(props.championshipId)),
)

function leagueDetails(league: League): string {
  return [
    league.organizer,
    league.season ? `temporada ${league.season}` : null,
    league.format ? LEAGUE_FORMAT_LABELS[league.format] : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

onMounted(async () => {
  try {
    await leagueContext.loadLeagues()
  } catch {
    return
  }
  if (group.value?.leagues.length !== 1) return
  if (router.currentRoute.value.name !== 'admin-select-league') return
  router.replace({ name: 'admin-dashboard', params: { leagueId: group.value.leagues[0].id } })
})
</script>

<template>
  <div>
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-2"
      :to="{ name: 'admin-select-championship' }"
    >
      Campeonatos
    </v-btn>

    <v-row v-if="leagueContext.loading && !leagueContext.loaded" justify="center" class="py-8">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="leagueContext.errorMessage" type="error">
      {{ leagueContext.errorMessage }}
    </v-alert>

    <v-alert v-else-if="!group" type="info" data-test="empty-state">
      Nenhuma liga disponível neste campeonato para o seu usuário.
    </v-alert>

    <template v-else>
      <PageHeader :title="group.championship.name" subtitle="Escolha a liga que deseja gerenciar." />

      <v-alert v-if="group.leagues.length === 0" type="info" variant="tonal" data-test="no-leagues">
        <p>Sem ligas para esse campeonato.</p>
        <v-btn
          v-if="authStore.hasRole('master')"
          color="primary"
          variant="flat"
          prepend-icon="mdi-pencil"
          class="mt-3"
          :to="{ name: 'admin-championships-edit', params: { id: group.championship.id } }"
          data-test="manage-championship"
        >
          Gerenciar campeonato
        </v-btn>
      </v-alert>

      <v-row v-else>
        <v-col v-for="league in group.leagues" :key="league.id" cols="12" sm="6" md="4" lg="3">
          <v-card
            :to="{ name: 'admin-dashboard', params: { leagueId: league.id } }"
            data-test="league-card"
          >
            <v-card-item>
              <template #append>
                <v-chip
                  v-if="league.id === leagueContext.activeLeagueId"
                  size="small"
                  color="primary"
                  variant="tonal"
                >
                  Atual
                </v-chip>
              </template>
              <v-card-title>{{ league.name }}</v-card-title>
              <v-card-subtitle>{{ leagueDetails(league) || 'Sem detalhes cadastrados' }}</v-card-subtitle>
            </v-card-item>
            <v-card-actions>
              <span class="text-primary text-body-2 font-weight-bold px-2">Gerenciar esta liga</span>
              <v-icon icon="mdi-arrow-right" color="primary" size="18" />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
