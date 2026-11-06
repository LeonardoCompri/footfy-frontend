<script setup lang="ts">
import { computed, ref } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { usersService } from '@/services/api/users.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { User } from '@/types/user'
import LeagueLinksDialog from '@/components/common/LeagueLinksDialog.vue'

const props = defineProps<{
  modelValue: boolean
  user: User
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: [user: User]
}>()

const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const busyLeagueId = ref<number | null>(null)

const linkedIds = computed(() => props.user.leagues.map((league) => league.id))

async function toggle(leagueId: number, linked: boolean) {
  busyLeagueId.value = leagueId
  try {
    const user = linked
      ? await usersService.detachLeague(props.user.id, leagueId)
      : await usersService.attachLeagues(props.user.id, [leagueId])
    emit('updated', user)
    snackbar.success(linked ? 'Usuário desvinculado da liga.' : 'Usuário vinculado à liga.')
  } catch (err) {
    snackbar.error(extractErrorMessage(err))
  } finally {
    busyLeagueId.value = null
  }
}
</script>

<template>
  <LeagueLinksDialog
    :model-value="modelValue"
    :title="`Ligas de ${user.name}`"
    subtitle="O usuário só acessa no painel as ligas vinculadas a ele."
    :leagues="leagueContext.leagues"
    :linked-ids="linkedIds"
    :busy-league-id="busyLeagueId"
    @update:model-value="emit('update:modelValue', $event)"
    @toggle="toggle"
  />
</template>
