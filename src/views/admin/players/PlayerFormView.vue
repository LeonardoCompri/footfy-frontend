<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { playersService } from '@/services/api/players.service'
import { teamsService } from '@/services/api/teams.service'
import type { Player, PlayerPayload } from '@/types/player'
import type { Team, TeamPayload } from '@/types/team'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<Player, PlayerPayload>(
  playersService,
)
const { items: teams, fetchAll: fetchAllTeams } = useCrud<Team, TeamPayload>(teamsService)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Jogador' : 'Novo Jogador'))

const form = reactive<PlayerPayload>({
  team_id: null,
  name: '',
  position: null,
  number: null,
  birth_date: null,
  document: null,
})

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

onMounted(async () => {
  fetchAllTeams()
  if (!props.id) return
  const player = await fetchOne(props.id)
  if (player) {
    form.team_id = player.team_id
    form.name = player.name
    form.position = player.position
    form.number = player.number
    form.birth_date = player.birth_date
    form.document = player.document
  }
})

async function handleSubmit() {
  form.number = toNullableNumber(form.number)
  const result = await save(form, props.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Jogador atualizado com sucesso.' : 'Jogador criado com sucesso.')
    router.push({ name: 'admin-players-list' })
  }
}
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-4">{{ pageTitle }}</h1>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text>
        <v-form @submit.prevent="handleSubmit">
          <v-text-field
            v-model="form.name"
            label="Nome"
            :error-messages="fieldErrors.name"
            class="mb-2"
          />
          <v-autocomplete
            v-model="form.team_id"
            :items="teams"
            item-title="name"
            item-value="id"
            label="Time"
            clearable
            :error-messages="fieldErrors.team_id"
            class="mb-2"
          />
          <v-text-field
            v-model="form.position"
            label="Posição"
            :error-messages="fieldErrors.position"
            class="mb-2"
          />
          <v-text-field
            v-model.number="form.number"
            label="Número"
            type="number"
            min="0"
            :error-messages="fieldErrors.number"
            class="mb-2"
          />
          <v-text-field
            v-model="form.birth_date"
            label="Data de nascimento"
            type="date"
            :error-messages="fieldErrors.birth_date"
            class="mb-2"
          />
          <v-text-field
            v-model="form.document"
            label="CPF"
            maxlength="11"
            :error-messages="fieldErrors.document"
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-players-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading">Salvar</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
