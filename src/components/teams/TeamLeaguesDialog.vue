<script setup lang="ts">
import { ref, watch } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { teamsService } from '@/services/api/teams.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { Team } from '@/types/team'
import LeagueLinksDialog from '@/components/common/LeagueLinksDialog.vue'

const props = defineProps<{
  modelValue: boolean
  team: Team
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()

const linkedIds = ref<number[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const busyLeagueId = ref<number | null>(null)

// GET /teams/{id} não traz `leagues`: sem isso, descobre o vínculo consultando a
// listagem escopada de cada liga acessível (só ao abrir o dialog).
async function loadLinks() {
  if (props.team.leagues) {
    linkedIds.value = props.team.leagues.map((league) => league.id)
    return
  }
  loading.value = true
  errorMessage.value = null
  try {
    const results = await Promise.all(
      leagueContext.leagues.map(async (league) => {
        const teams = await teamsService.list({ league_id: league.id })
        return teams.some((team) => team.id === props.team.id) ? league.id : null
      }),
    )
    linkedIds.value = results.filter((id): id is number => id !== null)
  } catch (err) {
    errorMessage.value = extractErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function toggle(leagueId: number, linked: boolean) {
  busyLeagueId.value = leagueId
  try {
    const team = linked
      ? await teamsService.detachLeague(props.team.id, leagueId)
      : await teamsService.attachLeagues(props.team.id, [leagueId])
    linkedIds.value = (team.leagues ?? []).map((league) => league.id)
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
    :loading="loading"
    :error-message="errorMessage"
    :busy-league-id="busyLeagueId"
    :locked-league-id="leagueContext.activeLeagueId"
    @update:model-value="emit('update:modelValue', $event)"
    @toggle="toggle"
  />
</template>
