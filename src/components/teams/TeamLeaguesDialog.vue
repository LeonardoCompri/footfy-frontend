<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { teamsService } from '@/services/api/teams.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import type { Team } from '@/types/team'

const props = defineProps<{
  modelValue: boolean
  team: Team
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const leagueContext = useLeagueContextStore()
const snackbar = useSnackbar()
const { xs } = useDisplay()

const linkedIds = ref<Set<number>>(new Set())
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const busyLeagueId = ref<number | null>(null)

// Ligas que o usuário acessa; a liga ativa vem primeiro e não pode ser desvinculada daqui.
const rows = computed(() =>
  [...leagueContext.leagues].sort(
    (a, b) => Number(b.id === leagueContext.activeLeagueId) - Number(a.id === leagueContext.activeLeagueId),
  ),
)

// GET /teams/{id} não traz `leagues`: sem isso, descobre o vínculo consultando a
// listagem escopada de cada liga acessível (só ao abrir o dialog).
async function loadLinks() {
  if (props.team.leagues) {
    linkedIds.value = new Set(props.team.leagues.map((league) => league.id))
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
    linkedIds.value = new Set(results.filter((id): id is number => id !== null))
  } catch (err) {
    errorMessage.value = extractErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function toggle(leagueId: number) {
  busyLeagueId.value = leagueId
  const linked = linkedIds.value.has(leagueId)
  try {
    const team = linked
      ? await teamsService.detachLeague(props.team.id, leagueId)
      : await teamsService.attachLeagues(props.team.id, [leagueId])
    linkedIds.value = new Set((team.leagues ?? []).map((league) => league.id))
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
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    :fullscreen="xs"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="text-truncate">Ligas de {{ team.name }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-card-subtitle class="text-wrap">
        O mesmo time (elenco e comissão) pode disputar mais de uma liga.
      </v-card-subtitle>
      <v-card-text>
        <div v-if="loading" class="d-flex justify-center py-6">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>
        <v-list v-else lines="two" class="pa-0">
          <v-list-item
            v-for="league in rows"
            :key="league.id"
            :title="league.name"
            :subtitle="league.championship?.name"
            data-test="team-league-row"
          >
            <template #append>
              <v-chip v-if="league.id === leagueContext.activeLeagueId" size="small" color="primary" variant="tonal">
                Liga atual
              </v-chip>
              <v-btn
                v-else
                size="small"
                :variant="linkedIds.has(league.id) ? 'outlined' : 'flat'"
                :color="linkedIds.has(league.id) ? 'error' : 'primary'"
                :loading="busyLeagueId === league.id"
                :disabled="busyLeagueId !== null && busyLeagueId !== league.id"
                data-test="team-league-toggle"
                @click="toggle(league.id)"
              >
                {{ linkedIds.has(league.id) ? 'Desvincular' : 'Vincular' }}
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
