<script setup lang="ts">
import { ref, watch } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { teamsService } from '@/services/api/teams.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { Team, TeamLeague } from '@/types/team'
import LeagueLinksDialog from '@/components/common/LeagueLinksDialog.vue'

const props = defineProps<{
  modelValue: boolean
  team: Team
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: [leagues: TeamLeague[]]
}>()

const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()

const linkedIds = ref<number[]>([])
const busyLeagueId = ref<number | null>(null)

function loadLinks() {
  linkedIds.value = (props.team.leagues ?? []).map((league) => league.id)
}

async function toggle(leagueId: number, linked: boolean) {
  busyLeagueId.value = leagueId
  try {
    const team = linked
      ? await teamsService.detachLeague(props.team.id, leagueId)
      : await teamsService.attachLeagues(props.team.id, [leagueId])
    linkedIds.value = (team.leagues ?? []).map((league) => league.id)
    emit('updated', team.leagues ?? [])
    snackbar.success(linked ? 'Time desvinculado da liga.' : 'Time vinculado à liga.')
  } catch (err) {
    snackbar.error(extractErrorMessage(err))
  } finally {
    busyLeagueId.value = null
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) loadLinks()
  },
  { immediate: true },
)
</script>

<template>
  <LeagueLinksDialog
    :model-value="modelValue"
    :title="`Ligas de ${team.name}`"
    subtitle="O mesmo time (elenco e comissão) pode disputar mais de uma liga."
    :leagues="leagueContext.leagues"
    :linked-ids="linkedIds"
    :busy-league-id="busyLeagueId"
    :locked-league-id="leagueContext.activeLeagueId"
    @update:model-value="emit('update:modelValue', $event)"
    @toggle="toggle"
  />
</template>
