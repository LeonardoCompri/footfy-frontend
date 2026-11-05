<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()

const accessDenied = computed(() => route.query.negado === '1')

function leaguesLabel(count: number): string {
  if (count === 0) return 'Sem ligas'
  return count === 1 ? '1 liga disponível' : `${count} ligas disponíveis`
}

// Recarrega sempre ao abrir a seleção: ligas criadas/vinculadas durante a sessão aparecem.
onMounted(async () => {
  try {
    await leagueContext.loadLeagues(true)
  } catch {
    return
  }
  // Com uma única liga não há o que escolher: entra direto nela. Não pula quando chegou aqui
  // por acesso negado (evita loop) nem para master, que só chega à gestão de campeonatos por aqui.
  const leagues = leagueContext.championships.flatMap((group) => group.leagues)
  if (leagues.length !== 1 || accessDenied.value || authStore.hasRole('master')) return
  if (router.currentRoute.value.name !== 'admin-select-championship') return
  router.replace({ name: 'admin-dashboard', params: { leagueId: leagues[0].id } })
})
</script>

<template>
  <div>
    <PageHeader
      title="Escolha o campeonato"
      subtitle="Selecione o campeonato e depois a liga que deseja gerenciar."
    >
      <template v-if="authStore.hasRole('master')" #action>
        <v-btn variant="outlined" prepend-icon="mdi-trophy" :to="{ name: 'admin-championships-list' }">
          Gerenciar campeonatos
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="accessDenied" type="warning" class="mb-4" data-test="access-denied">
      Você não tem acesso à liga solicitada. Escolha uma das ligas disponíveis abaixo.
    </v-alert>

    <v-row v-if="leagueContext.loading && !leagueContext.loaded" justify="center" class="py-8">
      <v-progress-circular indeterminate color="primary" />
    </v-row>

    <v-alert v-else-if="leagueContext.errorMessage" type="error">
      {{ leagueContext.errorMessage }}
    </v-alert>

    <v-alert v-else-if="leagueContext.championships.length === 0" type="info" data-test="empty-state">
      Nenhuma liga está vinculada ao seu usuário ainda. Peça a um administrador para vincular você
      a uma liga.
    </v-alert>

    <v-row v-else>
      <v-col
        v-for="group in leagueContext.championships"
        :key="group.championship.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card
          :to="{ name: 'admin-select-league', params: { championshipId: group.championship.id } }"
          data-test="championship-card"
        >
          <ChampionshipImage :src="group.championship.image" height="140">
            <v-sheet
              height="140"
              color="surface-variant"
              class="d-flex align-center justify-center"
            >
              <v-avatar color="primary" variant="tonal" size="56">
                <v-icon icon="mdi-trophy-outline" size="28" />
              </v-avatar>
            </v-sheet>
          </ChampionshipImage>
          <v-card-item>
            <v-card-title>{{ group.championship.name }}</v-card-title>
            <v-card-subtitle>{{ leaguesLabel(group.leagues.length) }}</v-card-subtitle>
          </v-card-item>
          <v-card-actions>
            <span class="text-primary text-body-2 font-weight-bold px-2">Selecionar</span>
            <v-icon icon="mdi-arrow-right" color="primary" size="18" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
