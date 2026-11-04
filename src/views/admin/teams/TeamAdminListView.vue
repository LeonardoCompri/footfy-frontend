<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { teamsService } from '@/services/api/teams.service'
import type { Team, TeamPayload } from '@/types/team'
import PageHeader from '@/components/common/PageHeader.vue'
import TeamFormDialog from '@/components/teams/TeamFormDialog.vue'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const router = useRouter()
const { items, loading, errorMessage, fetchAll } = useCrud<Team, TeamPayload>(teamsService)

const leagueId = leagueContext.activeLeagueId as number
const search = ref('')
const formDialog = ref(false)

const filteredTeams = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('pt-BR')
  if (!term) return items.value
  return items.value.filter((team) =>
    [team.name, team.nickname ?? ''].some((text) => text.toLocaleLowerCase('pt-BR').includes(term)),
  )
})

function initials(team: Team): string {
  return (team.nickname || team.name).slice(0, 2).toUpperCase()
}

function openTeam(team: Team) {
  router.push({ name: 'admin-teams-detail', params: { teamId: team.id } })
}

// Lista escopada pela Liga ativa (o layout remonta a tela ao trocar de liga).
onMounted(() => fetchAll({ league_id: leagueId }))
</script>

<template>
  <div>
    <PageHeader title="Times" :subtitle="leagueContext.activeLeague?.name">
      <template #action>
        <v-btn
          v-if="authStore.hasPermission('team:create')"
          color="primary"
          prepend-icon="mdi-plus"
          data-test="team-create"
          @click="formDialog = true"
        >
          <span class="d-none d-sm-inline">Novo time</span>
          <span class="d-sm-none">Novo</span>
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-text-field
      v-model="search"
      prepend-inner-icon="mdi-magnify"
      label="Buscar time"
      single-line
      hide-details
      clearable
      class="mb-4"
    />

    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="filteredTeams.length === 0" type="info" variant="tonal" data-test="teams-empty">
      {{ search ? 'Nenhum time encontrado para a busca.' : 'Nenhum time vinculado a esta liga ainda.' }}
    </v-alert>

    <v-row v-else>
      <v-col v-for="team in filteredTeams" :key="team.id" cols="12" sm="6" md="4" xl="3">
        <v-card
          :to="{ name: 'admin-teams-detail', params: { leagueId, teamId: team.id } }"
          data-test="team-card"
        >
          <v-card-item>
            <template #prepend>
              <v-avatar size="48" rounded="lg" color="primary" variant="tonal">
                <v-img v-if="team.logo" :src="team.logo" cover data-test="team-logo" />
                <span v-else class="font-weight-bold">{{ initials(team) }}</span>
              </v-avatar>
            </template>
            <v-card-title>{{ team.name }}</v-card-title>
            <v-card-subtitle>{{ team.nickname ?? '—' }}</v-card-subtitle>
            <template #append>
              <v-icon icon="mdi-chevron-right" class="text-medium-emphasis" />
            </template>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <TeamFormDialog v-model="formDialog" :league-id="leagueId" @saved="openTeam" />
  </div>
</template>
