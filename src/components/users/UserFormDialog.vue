<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useRemoteSelect } from '@/composables/useRemoteSelect'
import { useSnackbar } from '@/composables/useSnackbar'
import { playersService } from '@/services/api/players.service'
import { fetchAllPages } from '@/services/api/resource'
import { teamsService } from '@/services/api/teams.service'
import { usersService } from '@/services/api/users.service'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { USER_ROLE_OPTIONS } from '@/types/user'
import { cpfDigits } from '@/components/common/format'
import type { Team } from '@/types/team'
import type { User, UserPayload, UserPlayer, UserRole } from '@/types/user'
import FormDialog from '@/components/common/FormDialog.vue'
import CpfTextField from '@/components/common/CpfTextField.vue'

const props = defineProps<{
  modelValue: boolean
  user?: User | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [user: User]
}>()

const authStore = useAuthStore()
const leagueContext = useLeagueContextStore()
const { loading, errorMessage, fieldErrors, save } = useCrud<User, UserPayload>(usersService)
const snackbar = useSnackbar()

const isMaster = authStore.hasRole('master')
const roleOptions = isMaster
  ? USER_ROLE_OPTIONS
  : USER_ROLE_OPTIONS.filter((option) => option.value === 'coach' || option.value === 'player')

const isEditing = computed(() => !!props.user)
const canChangeRole = computed(() => isMaster || !isEditing.value)
const showPassword = ref(false)
const form = reactive({
  name: '',
  document: '',
  email: '' as string | null,
  password: '',
  role: 'admin' as UserRole,
  leagueIds: [] as number[],
  teamId: null as number | null,
  playerId: null as number | null,
})

const SEARCH_PER_PAGE = 20

const leagueTeamNames = ref(new Map<number, string>())
let leagueTeamsLoaded = false

const teamSelect = reactive(
  useRemoteSelect<Pick<Team, 'id' | 'name'>>({
    fetch: (search) =>
      teamsService
        .listPaginated({
          league_id: leagueContext.activeLeagueId ?? undefined,
          search: search || undefined,
          sort: 'name',
          order: 'asc',
          page: 1,
          per_page: SEARCH_PER_PAGE,
        })
        .then((result) => result.data),
    title: (team) => team.name,
    onError: () => snackbar.error('Não foi possível carregar os times da liga.'),
  }),
)

const playerSelect = reactive(
  useRemoteSelect<UserPlayer>({
    fetch: (search) => searchPlayers(search, SEARCH_PER_PAGE),
    title: playerTitle,
    onError: () => snackbar.error('Não foi possível carregar os jogadores.'),
  }),
)

const leagueItems = computed(() =>
  leagueContext.leagues.map((league) => ({
    id: league.id,
    title: league.championship ? `${league.name} (${league.championship.name})` : league.name,
  })),
)

function searchPlayers(search: string, perPage: number) {
  return playersService
    .listPaginated({
      league_id: leagueContext.activeLeagueId ?? undefined,
      search: search || undefined,
      sort: 'name',
      order: 'asc',
      page: 1,
      per_page: perPage,
    })
    .then((result) => result.data)
}

function playerTitle(player: UserPlayer) {
  const teamName = player.team_id === null ? undefined : leagueTeamNames.value.get(player.team_id)
  return teamName ? `${player.name} (${teamName})` : player.name
}

function loadLeagueTeamNames() {
  const leagueId = leagueContext.activeLeagueId
  if (leagueTeamsLoaded || !leagueId) return
  leagueTeamsLoaded = true
  fetchAllPages((page, perPage) =>
    teamsService.listPaginated({ league_id: leagueId, page, per_page: perPage }),
  )
    .then((teams) => {
      const names = new Map(leagueTeamNames.value)
      teams.forEach((team) => names.set(team.id, team.name))
      leagueTeamNames.value = names
    })
    .catch(() => (leagueTeamsLoaded = false))
}

const requiredLink = (message: string) => (value: number | null) =>
  isMaster || value !== null || message

function loadLinkOptions() {
  if (!props.modelValue) return
  if (form.role === 'coach') teamSelect.load()
  if (form.role === 'player') {
    loadLeagueTeamNames()
    playerSelect.load()
  }
}

async function suggestPlayerByDocument() {
  if (!props.modelValue || form.role !== 'player' || form.playerId !== null) return
  const digits = cpfDigits(form.document)
  if (digits.length !== 11) return
  const players = await searchPlayers(digits, 5).catch(() => [])
  const match = players.find((player) => cpfDigits(player.document) === digits)
  const stillPending =
    props.modelValue &&
    form.role === 'player' &&
    form.playerId === null &&
    cpfDigits(form.document) === digits
  if (!match || !stillPending) return
  playerSelect.selected = match
  form.playerId = match.id
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    errorMessage.value = null
    fieldErrors.value = {}
    showPassword.value = false
    form.name = props.user?.name ?? ''
    form.document = props.user?.document ?? ''
    form.email = props.user?.email ?? ''
    form.password = ''
    form.role = (props.user?.roles[0] as UserRole | undefined) ?? (isMaster ? 'admin' : 'coach')
    form.leagueIds = leagueContext.activeLeagueId ? [leagueContext.activeLeagueId] : []
    const currentTeam = form.role === 'coach' ? (props.user?.team ?? null) : null
    form.teamId = currentTeam?.id ?? null
    form.playerId = props.user?.player?.id ?? null
    leagueTeamsLoaded = false
    leagueTeamNames.value = new Map(
      props.user?.team ? [[props.user.team.id, props.user.team.name]] : [],
    )
    teamSelect.reset(currentTeam)
    playerSelect.reset(props.user?.player ?? null)
    loadLinkOptions()
  },
  { immediate: true },
)

watch(() => form.role, loadLinkOptions)

watch([() => props.modelValue, () => form.document, () => form.role], suggestPlayerByDocument, {
  immediate: true,
})

async function handleSubmit() {
  const payload: UserPayload = {
    name: form.name,
    document: form.document,
    email: form.email || null,
  }
  if (form.password) payload.password = form.password
  if (canChangeRole.value) payload.role = form.role
  if (form.role === 'coach') payload.team_id = form.teamId
  if (form.role === 'player') payload.player_id = form.playerId

  let result = await save(payload, props.user?.id)
  if (!result) return

  if (!isEditing.value && form.role === 'admin' && form.leagueIds.length) {
    try {
      result = await usersService.attachLeagues(result.id, form.leagueIds)
    } catch {
      snackbar.error('Usuário criado, mas não foi possível vincular as ligas.')
      emit('saved', result)
      emit('update:modelValue', false)
      return
    }
  }

  snackbar.success(isEditing.value ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.')
  emit('saved', result)
  emit('update:modelValue', false)
}
</script>

<template>
  <FormDialog
    :model-value="modelValue"
    :title="isEditing ? 'Editar usuário' : 'Novo usuário'"
    :loading="loading"
    :error-message="errorMessage"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  >
    <v-text-field v-model="form.name" label="Nome" :error-messages="fieldErrors.name" data-test="user-name" />
    <v-row dense>
      <v-col cols="12" sm="6">
        <CpfTextField v-model="form.document" required :error-messages="fieldErrors.document" data-test="user-document" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-text-field v-model="form.email" label="E-mail" type="email" :error-messages="fieldErrors.email" />
      </v-col>
    </v-row>
    <v-text-field
      v-model="form.password"
      label="Senha"
      :type="showPassword ? 'text' : 'password'"
      :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
      :hint="isEditing ? 'Deixe em branco para manter a senha atual' : 'Mínimo de 6 caracteres'"
      persistent-hint
      autocomplete="new-password"
      :error-messages="fieldErrors.password"
      data-test="user-password"
      @click:append-inner="showPassword = !showPassword"
    />
    <v-select
      v-if="canChangeRole"
      v-model="form.role"
      :items="roleOptions"
      item-title="title"
      item-value="value"
      label="Papel"
      class="mt-2"
      :error-messages="fieldErrors.role"
      data-test="user-role"
    />
    <v-autocomplete
      v-if="form.role === 'coach'"
      v-model="form.teamId"
      :items="teamSelect.items"
      item-title="title"
      item-value="id"
      label="Time"
      no-filter
      :loading="teamSelect.loading"
      :clearable="isMaster"
      :rules="[requiredLink('Informe o time do coach.')]"
      no-data-text="Nenhum time encontrado nesta liga."
      :class="{ 'mt-2': !canChangeRole }"
      :error-messages="fieldErrors.team_id"
      data-test="user-team"
      @update:model-value="teamSelect.select"
      @update:search="teamSelect.search"
    />
    <v-autocomplete
      v-if="form.role === 'player'"
      v-model="form.playerId"
      :items="playerSelect.items"
      item-title="title"
      item-value="id"
      label="Jogador"
      hint="Busque por nome ou CPF. O jogador com o mesmo CPF do usuário é sugerido."
      persistent-hint
      no-filter
      :loading="playerSelect.loading"
      :clearable="isMaster"
      :rules="[requiredLink('Informe o jogador vinculado ao usuário.')]"
      no-data-text="Nenhum jogador encontrado."
      :class="{ 'mt-2': !canChangeRole }"
      :error-messages="fieldErrors.player_id"
      data-test="user-player"
      @update:model-value="playerSelect.select"
      @update:search="playerSelect.search"
    />
    <v-autocomplete
      v-if="!isEditing && form.role === 'admin'"
      v-model="form.leagueIds"
      :items="leagueItems"
      item-title="title"
      item-value="id"
      label="Ligas vinculadas"
      multiple
      chips
      closable-chips
      data-test="user-leagues"
    />
  </FormDialog>
</template>
