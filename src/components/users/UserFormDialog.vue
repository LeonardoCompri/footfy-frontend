<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { playersService } from '@/services/api/players.service'
import { teamsService } from '@/services/api/teams.service'
import { usersService } from '@/services/api/users.service'
import { useAuthStore } from '@/stores/auth'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { USER_ROLE_OPTIONS } from '@/types/user'
import { cpfDigits } from '@/components/common/format'
import type { Player } from '@/types/player'
import type { Team } from '@/types/team'
import type { User, UserPayload, UserRole } from '@/types/user'
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

// Regra do backend: admin só cria coach e player e só master troca o papel na edição.
// Para quem não é master o vínculo do papel (time do coach, jogador do player) é obrigatório.
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

const teams = ref<Team[]>([])
const players = ref<Player[]>([])
const linksLoading = ref(false)
let teamsRequest: Promise<void> | null = null
let playersRequest: Promise<void> | null = null

const leagueItems = computed(() =>
  leagueContext.leagues.map((league) => ({
    id: league.id,
    title: league.championship ? `${league.name} (${league.championship.name})` : league.name,
  })),
)

// Times da liga ativa; o time atual do coach entra mesmo se for de outra liga.
const teamItems = computed(() => {
  const items = teams.value.map((team) => ({ id: team.id, title: team.name }))
  const current = props.user?.roles.includes('coach') ? props.user.team : null
  if (current && !items.some((item) => item.id === current.id)) {
    items.push({ id: current.id, title: current.name })
  }
  return items
})

// GET /players não filtra por liga: fica só com os jogadores dos times da liga ativa.
const leaguePlayers = computed(() => {
  const teamIds = new Set(teams.value.map((team) => team.id))
  return players.value.filter((player) => player.team_id !== null && teamIds.has(player.team_id))
})

const playerItems = computed(() => {
  const teamNames = new Map(teams.value.map((team) => [team.id, team.name]))
  const items = leaguePlayers.value.map((player) => ({
    id: player.id,
    title: `${player.name} (${teamNames.get(player.team_id as number)})`,
  }))
  const current = props.user?.player
  if (current && !items.some((item) => item.id === current.id)) {
    const teamName = props.user?.team?.name
    items.push({ id: current.id, title: teamName ? `${current.name} (${teamName})` : current.name })
  }
  return items
})

const requiredLink = (message: string) => (value: number | null) =>
  isMaster || value !== null || message

function loadLinkOptions() {
  if (!props.modelValue || (form.role !== 'coach' && form.role !== 'player')) return
  const requests: Promise<void>[] = []
  teamsRequest ??= teamsService
    .list({ league_id: leagueContext.activeLeagueId ?? undefined })
    .then((data) => {
      teams.value = data
    })
    .catch(() => {
      teamsRequest = null
      snackbar.error('Não foi possível carregar os times da liga.')
    })
  requests.push(teamsRequest)
  if (form.role === 'player') {
    playersRequest ??= playersService
      .list()
      .then((data) => {
        players.value = data
      })
      .catch(() => {
        playersRequest = null
        snackbar.error('Não foi possível carregar os jogadores.')
      })
    requests.push(playersRequest)
  }
  linksLoading.value = true
  Promise.all(requests).finally(() => (linksLoading.value = false))
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
    // Novo usuário já nasce vinculado à liga ativa (pode ajustar antes de salvar).
    form.leagueIds = leagueContext.activeLeagueId ? [leagueContext.activeLeagueId] : []
    form.teamId = form.role === 'coach' ? (props.user?.team?.id ?? null) : null
    form.playerId = props.user?.player?.id ?? null
    // Recarrega a cada abertura: vínculos feitos desde a última vez entram nas opções.
    teamsRequest = null
    playersRequest = null
    loadLinkOptions()
  },
  { immediate: true },
)

watch(() => form.role, loadLinkOptions)

// Sugere o jogador com o mesmo CPF do usuário, sem sobrescrever uma escolha já feita.
watch([() => form.document, () => form.role, leaguePlayers], () => {
  if (form.role !== 'player' || form.playerId !== null) return
  const digits = cpfDigits(form.document)
  if (digits.length !== 11) return
  const match = leaguePlayers.value.find((player) => cpfDigits(player.document) === digits)
  if (match) form.playerId = match.id
})

async function handleSubmit() {
  const payload: UserPayload = {
    name: form.name,
    document: form.document,
    email: form.email || null,
  }
  if (form.password) payload.password = form.password
  if (canChangeRole.value) payload.role = form.role
  // Só o campo do papel atual: o outro é rejeitado pelo backend (prohibited).
  if (form.role === 'coach') payload.team_id = form.teamId
  if (form.role === 'player') payload.player_id = form.playerId

  let result = await save(payload, props.user?.id)
  if (!result) return

  // Coach e player herdam as ligas do time vinculado: só admin recebe ligas manualmente.
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
    <v-select
      v-if="form.role === 'coach'"
      v-model="form.teamId"
      :items="teamItems"
      item-title="title"
      item-value="id"
      label="Time"
      :loading="linksLoading"
      :clearable="isMaster"
      :rules="[requiredLink('Informe o time do coach.')]"
      no-data-text="Nenhum time nesta liga."
      :class="{ 'mt-2': !canChangeRole }"
      :error-messages="fieldErrors.team_id"
      data-test="user-team"
    />
    <v-autocomplete
      v-if="form.role === 'player'"
      v-model="form.playerId"
      :items="playerItems"
      item-title="title"
      item-value="id"
      label="Jogador"
      hint="Sugerido pelo CPF quando há um jogador com o mesmo documento."
      persistent-hint
      :loading="linksLoading"
      :clearable="isMaster"
      :rules="[requiredLink('Informe o jogador vinculado ao usuário.')]"
      no-data-text="Nenhum jogador nesta liga."
      :class="{ 'mt-2': !canChangeRole }"
      :error-messages="fieldErrors.player_id"
      data-test="user-player"
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
