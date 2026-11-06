<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { teamsService } from '@/services/api/teams.service'
import { technicalCommitteeMembersService } from '@/services/api/technicalCommitteeMembers.service'
import { optionTitle, type SelectOption } from '@/types/api'
import type { Team } from '@/types/team'
import type {
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload,
} from '@/types/technicalCommitteeMember'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import TechnicalCommitteeMemberFormDialog from '@/components/technicalCommitteeMembers/TechnicalCommitteeMemberFormDialog.vue'
import { formatBirthDate } from '@/components/common/format'

const props = defineProps<{ teamId: string; id: string }>()

const router = useRouter()
const authStore = useAuthStore()
const leagueId = useLeagueContextStore().activeLeagueId as number
const snackbar = useSnackbar()
const { errorMessage, fetchOne, destroy } = useCrud<
  TechnicalCommitteeMember,
  TechnicalCommitteeMemberPayload
>(technicalCommitteeMembersService)

const member = ref<TechnicalCommitteeMember | null>(null)
const team = ref<Team | null>(null)
const roles = ref<SelectOption[]>([])
const initializing = ref(true)
const editDialog = ref(false)
const deleteDialog = ref(false)

const canUpdate = authStore.hasPermission('technical_committee_member:update')
const canDelete = authStore.hasPermission('technical_committee_member:delete')

const teamRoute = computed(() => ({
  name: 'admin-teams-detail',
  params: { leagueId, teamId: props.teamId },
  query: { tab: 'comissao' },
}))

const profile = computed(() => {
  if (!member.value) return []
  return [
    { label: 'Time', value: team.value?.name ?? '—', icon: 'mdi-shield' },
    { label: 'Função', value: optionTitle(roles.value, member.value.role), icon: 'mdi-clipboard-account' },
    { label: 'Nascimento', value: formatBirthDate(member.value.birth_date), icon: 'mdi-cake-variant' },
  ]
})

async function handleDelete() {
  if (!member.value) return
  if (await destroy(member.value.id)) {
    snackbar.success('Membro excluído com sucesso.')
    router.push(teamRoute.value)
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir o membro.')
  }
}

onMounted(async () => {
  technicalCommitteeMembersService.roles().then((data) => (roles.value = data)).catch(() => undefined)
  try {
    const [loadedMember, loadedTeam] = await Promise.all([
      fetchOne(props.id),
      teamsService.get(props.teamId).catch(() => null),
    ])
    member.value = loadedMember
    team.value = loadedTeam
  } finally {
    initializing.value = false
  }
})
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2" :to="teamRoute" data-test="back-to-team">
      {{ team?.name ?? 'Time' }}
    </v-btn>

    <div v-if="initializing" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="!member" type="error" variant="tonal">
      {{ errorMessage ?? 'Membro da comissão técnica não encontrado.' }}
    </v-alert>

    <template v-else>
      <v-card class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-4">
          <v-avatar size="64" color="primary" variant="tonal">
            <v-icon icon="mdi-clipboard-account" size="32" />
          </v-avatar>
          <div class="header-title">
            <h1 class="text-h5 text-sm-h4 font-weight-bold text-break" data-test="member-title">
              {{ member.name }}
            </h1>
            <div class="text-medium-emphasis">{{ optionTitle(roles, member.role) }}</div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-if="canUpdate"
              variant="tonal"
              prepend-icon="mdi-pencil"
              data-test="member-edit"
              @click="editDialog = true"
            >
              Editar
            </v-btn>
            <v-btn
              v-if="canDelete"
              variant="tonal"
              color="error"
              prepend-icon="mdi-delete"
              data-test="member-delete"
              @click="deleteDialog = true"
            >
              Excluir
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">Perfil</v-card-title>
        <v-list lines="two" data-test="member-profile">
          <v-list-item
            v-for="field in profile"
            :key="field.label"
            :prepend-icon="field.icon"
            :title="field.value"
            :subtitle="field.label"
          />
        </v-list>
      </v-card>

      <TechnicalCommitteeMemberFormDialog
        v-model="editDialog"
        :team-id="Number(teamId)"
        :member="member"
        @saved="member = $event"
      />
      <ConfirmDialog
        v-model="deleteDialog"
        title="Excluir membro"
        :message="`Tem certeza que deseja excluir '${member.name}'?`"
        @confirm="handleDelete"
      />
    </template>
  </div>
</template>

<style scoped>
.header-title {
  flex: 1 1 0;
  min-width: 160px;
}
</style>
