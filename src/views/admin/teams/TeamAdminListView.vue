<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useCrud } from '@/composables/useCrud'
import { SERVER_TABLE_PER_PAGE_OPTIONS, useServerTable } from '@/composables/useServerTable'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { teamsService } from '@/services/api/teams.service'
import type { Team, TeamPayload, TeamSortField } from '@/types/team'
import PageHeader from '@/components/common/PageHeader.vue'
import TeamFormDialog from '@/components/teams/TeamFormDialog.vue'

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const router = useRouter()
const { xs } = useDisplay()
const { items, meta, loading, errorMessage, fetchPage } = useCrud<Team, TeamPayload>(teamsService)

const leagueId = leagueContext.activeLeagueId as number
const formDialog = ref(false)

const { search, appliedSearch, page, perPage, sortBy } = useServerTable<TeamSortField>((params) =>
  fetchPage({ ...params, league_id: leagueId }),
)

const headers = computed(() => [
  { title: 'Time', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Apelido', key: 'nickname' }]),
  {
    title: '',
    key: 'actions',
    sortable: false,
    align: 'end' as const,
    headerProps: { class: 'px-2' },
    cellProps: { class: 'px-2' },
  },
])

function initials(team: Team): string {
  return (team.nickname || team.name).slice(0, 2).toUpperCase()
}

function teamRoute(team: Team) {
  return { name: 'admin-teams-detail', params: { leagueId, teamId: team.id } }
}

function openTeam(team: Team) {
  router.push(teamRoute(team))
}

function onRowClick(_event: Event, row: { item: Team }) {
  openTeam(row.item)
}
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

    <v-card>
      <v-card-text>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Buscar time"
          single-line
          hide-details
          clearable
          class="mb-4"
          data-test="teams-search"
        />
        <v-data-table-server
          v-model:page="page"
          v-model:items-per-page="perPage"
          v-model:sort-by="sortBy"
          :headers="headers"
          :items="items"
          :items-length="meta?.total ?? 0"
          :items-per-page-options="SERVER_TABLE_PER_PAGE_OPTIONS"
          :loading="loading"
          item-value="id"
          :no-data-text="
            appliedSearch
              ? 'Nenhum time encontrado para a busca.'
              : 'Nenhum time vinculado a esta liga ainda.'
          "
          hover
          data-test="teams-table"
          @click:row="onRowClick"
        >
          <template v-slot:[`item.name`]="{ item }">
            <div class="d-flex align-center ga-3 py-2">
              <v-avatar size="40" rounded="lg" color="primary" variant="tonal">
                <v-img v-if="item.logo" :src="item.logo" cover data-test="team-logo" />
                <span v-else class="font-weight-bold">{{ initials(item) }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-medium" data-test="team-name">{{ item.name }}</div>
                <div v-if="xs && item.nickname" class="text-caption text-medium-emphasis">
                  {{ item.nickname }}
                </div>
              </div>
            </div>
          </template>
          <template v-slot:[`item.nickname`]="{ item }">{{ item.nickname ?? '—' }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-eye-outline"
              variant="text"
              size="small"
              :to="teamRoute(item)"
              :aria-label="`Ver time ${item.name}`"
              data-test="team-view"
              @click.stop
            />
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <TeamFormDialog v-model="formDialog" :league-id="leagueId" @saved="openTeam" />
  </div>
</template>
