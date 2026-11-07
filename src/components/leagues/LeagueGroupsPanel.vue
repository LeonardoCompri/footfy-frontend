<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { leaguesService } from '@/services/api/leagues.service'
import type { LeagueGroups } from '@/types/leagueRules'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import {
  arrangeGroups,
  groupLetter,
  groupMap,
  groupName,
  groupsPayload,
  groupStructureProblem,
  groupTeams,
  hasAssignedTeams,
  sameGroupMap,
  validateGroups,
  type GroupMap,
} from './leagueGroups'

const props = defineProps<{
  leagueId: number
  data: LeagueGroups
  disabled?: boolean
}>()

const emit = defineEmits<{
  updated: [data: LeagueGroups]
}>()

const snackbar = useSnackbar()
const assignment = ref<GroupMap>(groupMap(props.data))
const error = ref<string | null>(null)
const saving = ref(false)
const shuffling = ref(false)
const confirmShuffle = ref(false)

watch(
  () => props.data,
  (data) => {
    assignment.value = groupMap(data)
    error.value = null
  },
)

const teams = computed(() => groupTeams(props.data))
const arranged = computed(() =>
  arrangeGroups(teams.value, assignment.value, props.data.groups_count),
)
const changed = computed(() => !sameGroupMap(assignment.value, groupMap(props.data)))
const structureProblem = computed(() =>
  groupStructureProblem(teams.value.length, props.data.groups_count),
)
const groupOptions = computed(() =>
  Array.from({ length: props.data.groups_count }, (_, index) => ({
    value: index + 1,
    title: groupName(index + 1),
  })),
)
const sections = computed(() => [
  ...(arranged.value.unassigned.length
    ? [{ key: 'unassigned', title: 'Sem grupo', teams: arranged.value.unassigned, wide: true }]
    : []),
  ...arranged.value.groups.map((group) => ({
    key: `group-${group.group_number}`,
    title: groupName(group.group_number),
    teams: group.teams,
    wide: false,
  })),
])

function move(teamId: number, groupNumber: number | null) {
  assignment.value = { ...assignment.value, [teamId]: groupNumber }
}

async function request(call: () => Promise<LeagueGroups>, success: string) {
  error.value = null
  try {
    emit('updated', await call())
    snackbar.success(success)
  } catch (err) {
    error.value = extractErrorMessage(err)
  }
}

function askShuffle() {
  if (hasAssignedTeams(assignment.value)) confirmShuffle.value = true
  else shuffle()
}

async function shuffle() {
  shuffling.value = true
  await request(
    () => leaguesService.shuffleGroups(props.leagueId),
    'Times distribuídos nos grupos.',
  )
  shuffling.value = false
}

async function save() {
  const problem = validateGroups(teams.value, assignment.value, props.data.groups_count)
  if (problem) {
    error.value = problem
    return
  }
  saving.value = true
  await request(
    () => leaguesService.saveGroups(props.leagueId, groupsPayload(teams.value, assignment.value)),
    'Grupos salvos com sucesso.',
  )
  saving.value = false
}
</script>

<template>
  <v-card data-test="groups-panel">
    <v-card-title class="text-wrap">Montagem dos grupos</v-card-title>
    <v-card-text>
      <v-alert
        v-if="data.locked"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
        data-test="groups-locked"
      >
        A liga já tem rodadas sorteadas: os grupos não podem mais ser alterados.
      </v-alert>
      <template v-else>
        <v-alert
          v-if="structureProblem"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
          data-test="groups-problem"
        >
          {{ structureProblem }}
        </v-alert>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
          data-test="groups-error"
        >
          {{ error }}
        </v-alert>
        <div class="d-flex flex-wrap ga-2 mb-4">
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-shuffle-variant"
            class="text-none"
            :loading="shuffling"
            :disabled="disabled || !!structureProblem || saving"
            data-test="groups-shuffle"
            @click="askShuffle"
          >
            Distribuir aleatoriamente
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-save"
            class="text-none"
            :loading="saving"
            :disabled="disabled || !changed || shuffling"
            data-test="groups-save"
            @click="save"
          >
            Salvar grupos
          </v-btn>
        </div>
      </template>

      <v-row dense>
        <v-col
          v-for="section in sections"
          :key="section.key"
          cols="12"
          :md="section.wide ? 12 : 6"
          :xl="section.wide ? 12 : 4"
        >
          <v-card
            class="fill-height"
            :data-test="section.wide ? 'groups-unassigned' : 'group-card'"
          >
            <div class="d-flex align-center ga-2 px-4 pt-3">
              <v-icon v-if="section.wide" icon="mdi-alert-circle-outline" color="warning" />
              <span class="text-subtitle-1 font-weight-bold" data-test="group-title">
                {{ section.title }}
              </span>
              <v-chip size="x-small" variant="tonal">{{ section.teams.length }}</v-chip>
            </div>
            <v-list v-if="section.teams.length" density="compact" bg-color="transparent">
              <v-list-item v-for="team in section.teams" :key="team.id" data-test="group-team">
                <v-list-item-title class="text-wrap">{{ team.name }}</v-list-item-title>
                <template #prepend>
                  <v-avatar size="28" rounded="lg" color="primary" variant="tonal" class="mr-3">
                    <v-img v-if="team.logo" :src="team.logo" cover />
                    <v-icon v-else icon="mdi-shield-outline" size="18" />
                  </v-avatar>
                </template>
                <template v-if="!data.locked" #append>
                  <v-select
                    :model-value="assignment[team.id]"
                    :items="groupOptions"
                    placeholder="—"
                    density="compact"
                    width="96"
                    hide-details
                    :disabled="disabled"
                    :aria-label="`Grupo de ${team.name}`"
                    class="ml-2"
                    data-test="group-team-select"
                    @update:model-value="move(team.id, $event)"
                  >
                    <template #selection="{ item }">{{ groupLetter(item.value) }}</template>
                  </v-select>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-body-2 text-medium-emphasis px-4 py-3 mb-0">Nenhum time.</p>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <ConfirmDialog
      v-model="confirmShuffle"
      title="Distribuir aleatoriamente"
      message="A distribuição atual dos grupos será substituída por um novo sorteio. Deseja continuar?"
      confirm-text="Distribuir"
      @confirm="shuffle"
    />
  </v-card>
</template>
