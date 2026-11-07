<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay, type SubmitEventPromise } from 'vuetify'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { championshipsService } from '@/services/api/championships.service'
import { leaguesService } from '@/services/api/leagues.service'
import { useLeagueContextStore } from '@/stores/leagueContext'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import type { Championship, ChampionshipPayload, League, LeaguePayload } from '@/types/championship'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'
import ChampionshipImagePreviewDialog from '@/components/championships/ChampionshipImagePreviewDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PasswordDeleteDialog from '@/components/common/PasswordDeleteDialog.vue'

interface LeagueForm extends LeaguePayload {
  key: number
}

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<
  Championship,
  ChampionshipPayload
>(championshipsService)
const snackbar = useSnackbar()
const { smAndDown } = useDisplay()
const leagueContext = useLeagueContextStore()
const {
  open: deleteDialog,
  target: leagueToDelete,
  ask: askDelete,
} = useConfirmDialog<{
  id: number
  name: string
}>()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Campeonato' : 'Novo Campeonato'))
const initializing = ref(isEditing.value)

const formatOptions = Object.entries(LEAGUE_FORMAT_LABELS).map(([value, title]) => ({
  value,
  title,
}))

const form = reactive({
  name: '',
  leagues: [] as LeagueForm[],
})
const openPanels = ref<number[]>([])
let nextKey = 0

const requiredName = (value: string | null) => !!value?.trim() || 'Informe o nome.'

function endAfterStart(league: LeagueForm) {
  if (!league.start_date || !league.end_date || league.end_date > league.start_date) return true
  return 'A data de término deve ser depois da data de início.'
}

function toLeagueForm(league?: League): LeagueForm {
  return {
    key: nextKey++,
    id: league?.id,
    name: league?.name ?? '',
    format: league ? (league.format ?? null) : 'round_robin',
    season: league?.season ?? null,
    organizer: league?.organizer ?? null,
    start_date: league?.start_date?.slice(0, 10) ?? null,
    end_date: league?.end_date?.slice(0, 10) ?? null,
  }
}

function leagueSummary(league: LeagueForm): string {
  return [
    league.format ? LEAGUE_FORMAT_LABELS[league.format] : null,
    league.season ? `Temporada ${league.season}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function leagueError(index: number, field: string): string[] | undefined {
  return fieldErrors.value[`leagues.${index}.${field}`]
}

function openLeaguePanels(keys: number[]) {
  openPanels.value = [...new Set([...openPanels.value, ...keys])]
}

function addLeague() {
  const league = toLeagueForm()
  form.leagues.push(league)
  openLeaguePanels([league.key])
}

function dropLeague(key: number) {
  form.leagues = form.leagues.filter((league) => league.key !== key)
  fieldErrors.value = Object.fromEntries(
    Object.entries(fieldErrors.value).filter(([field]) => !field.startsWith('leagues.')),
  )
}

function removeLeague(league: LeagueForm) {
  if (league.id) askDelete({ id: league.id, name: league.name })
  else dropLeague(league.key)
}

const LEAGUE_REMOVED = [
  'partidas e súmulas',
  'estádios da liga',
  'vínculos dos times e dos usuários com a liga',
]

async function deleteLeague(password: string) {
  if (leagueToDelete.value) {
    await leaguesService.removeWithPassword(leagueToDelete.value.id, password)
  }
}

function onLeagueDeleted() {
  const leagueId = leagueToDelete.value?.id
  const league = form.leagues.find((item) => item.id === leagueId)
  if (league) dropLeague(league.key)
  snackbar.success('Liga excluída com sucesso.')
  if (leagueContext.activeLeagueId === leagueId) leagueContext.clearActiveLeague()
  leagueContext.loadLeagues(true).catch(() => undefined)
}

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const existingImageUrl = ref<string | null>(null)
const newImageUrl = ref<string | null>(null)
const imagePreview = computed(() => newImageUrl.value ?? existingImageUrl.value)
const previewDialog = ref(false)
const imageError = ref<string | null>(null)
const removeImage = ref(false)

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX_BYTES = 2 * 1024 * 1024

function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use uma imagem JPG, PNG ou WebP.'
  if (file.size > IMAGE_MAX_BYTES) return 'A imagem deve ter no máximo 2 MB.'
  return null
}

function selectImage(file: File | null) {
  if (newImageUrl.value) URL.revokeObjectURL(newImageUrl.value)
  selectedFile.value = file
  newImageUrl.value = file ? URL.createObjectURL(file) : null
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    imageError.value = validateImage(file)
    if (!imageError.value) selectImage(file)
  }
  input.value = ''
}

function clearImage() {
  selectImage(null)
  if (existingImageUrl.value) {
    existingImageUrl.value = null
    removeImage.value = true
  }
}

onBeforeUnmount(() => selectImage(null))

onMounted(async () => {
  if (!props.id) return
  try {
    const championship = await fetchOne(props.id)
    if (championship) {
      form.name = championship.name
      form.leagues = (championship.leagues ?? []).map((league) => toLeagueForm(league))
      existingImageUrl.value = championship.image
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit(event: SubmitEventPromise) {
  const { valid } = await event
  if (!valid) {
    openLeaguePanels(
      form.leagues
        .filter((league) => requiredName(league.name) !== true || endAfterStart(league) !== true)
        .map((league) => league.key),
    )
    return
  }

  const payload: ChampionshipPayload = {
    name: form.name,
    image: selectedFile.value,
    removeImage: removeImage.value,
    leagues: form.leagues,
  }
  const result = await save(payload, props.id)
  if (!result) {
    openLeaguePanels(
      form.leagues
        .filter((_, index) =>
          Object.keys(fieldErrors.value).some((field) => field.startsWith(`leagues.${index}.`)),
        )
        .map((league) => league.key),
    )
    return
  }

  leagueContext.loadLeagues(true).catch(() => undefined)
  snackbar.success(
    isEditing.value ? 'Campeonato atualizado com sucesso.' : 'Campeonato criado com sucesso.',
  )
  router.push({ name: 'admin-championships-list' })
}
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{
      errorMessage
    }}</v-alert>

    <v-card v-if="initializing">
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
    </v-card>

    <v-form v-else @submit.prevent="handleSubmit">
      <v-card title="Campeonato" class="mb-4">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="7">
              <v-text-field
                v-model="form.name"
                label="Nome"
                :rules="[requiredName]"
                :error-messages="fieldErrors.name"
                data-test="championship-name"
              />
              <p class="text-body-2 text-medium-emphasis" data-test="championship-image-help">
                JPG, PNG ou WebP até 2 MB. Ideal: logo ou arte horizontal (ex.: 1600×800). A imagem
                aparece inteira em todos os lugares: nas listas de campeonatos, na página pública e
                no topo do painel da liga.
              </p>
            </v-col>

            <v-col cols="12" md="5">
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                data-test="championship-image-input"
                @change="onFileChange"
              />

              <ChampionshipImage
                v-if="imagePreview"
                :src="imagePreview"
                :height="smAndDown ? 200 : 240"
                rounded="lg"
                data-test="championship-image-preview"
              >
                <template #overlay>
                  <div class="d-flex flex-column align-end fill-height pa-2">
                    <v-btn
                      icon="mdi-delete"
                      color="error"
                      aria-label="Remover imagem"
                      data-test="championship-image-remove"
                      @click="clearImage"
                    />
                    <v-spacer />
                    <v-btn
                      icon="mdi-camera"
                      color="surface"
                      aria-label="Trocar imagem"
                      data-test="championship-image-change"
                      @click="fileInput?.click()"
                    />
                  </div>
                </template>
              </ChampionshipImage>

              <v-btn
                v-else
                block
                :height="smAndDown ? 200 : 240"
                variant="flat"
                color="surface-variant"
                rounded="lg"
                data-test="championship-image-empty"
                @click="fileInput?.click()"
              >
                <div class="d-flex flex-column align-center ga-2">
                  <v-icon icon="mdi-image-plus" size="40" />
                  Clique para enviar a imagem
                </div>
              </v-btn>

              <div
                v-if="imageError || fieldErrors.image"
                class="text-caption text-error mt-1"
                data-test="championship-image-error"
              >
                {{ imageError ?? fieldErrors.image?.[0] }}
              </div>

              <v-btn
                block
                size="large"
                variant="outlined"
                prepend-icon="mdi-eye"
                class="mt-3"
                :disabled="!imagePreview"
                data-test="championship-image-preview-open"
                @click="previewDialog = true"
              >
                Visualizar aplicação
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="mb-4" data-test="leagues-card">
        <div class="d-flex flex-wrap align-center ga-2 pa-4">
          <span class="text-h6">Ligas</span>
          <v-chip size="small" data-test="leagues-count">{{ form.leagues.length }}</v-chip>
          <v-spacer />
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            data-test="league-add"
            @click="addLeague"
          >
            Adicionar liga
          </v-btn>
        </div>

        <v-card-text class="pt-0">
          <p
            v-if="form.leagues.length === 0"
            class="text-medium-emphasis"
            data-test="leagues-empty"
          >
            Nenhuma liga neste campeonato. As ligas são opcionais e podem ser adicionadas depois.
          </p>

          <v-expansion-panels v-else v-model="openPanels" multiple variant="accordion">
            <v-expansion-panel
              v-for="(league, index) in form.leagues"
              :key="league.key"
              :value="league.key"
              data-test="league-panel"
            >
              <v-expansion-panel-title>
                <div class="overflow-hidden">
                  <div class="font-weight-medium text-truncate" data-test="league-panel-title">
                    {{ league.name || 'Nova liga' }}
                  </div>
                  <div class="text-caption text-medium-emphasis text-truncate">
                    {{ leagueSummary(league) || 'Sem detalhes' }}
                  </div>
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text eager>
                <v-alert
                  v-if="leagueError(index, 'id')"
                  type="error"
                  variant="tonal"
                  density="compact"
                  class="mb-4"
                  data-test="league-error"
                >
                  {{ leagueError(index, 'id')?.[0] }}
                </v-alert>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="league.name"
                      label="Nome da liga*"
                      :rules="[requiredName]"
                      :error-messages="leagueError(index, 'name')"
                      data-test="league-name"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select
                      v-model="league.format"
                      :items="formatOptions"
                      label="Formato"
                      :error-messages="leagueError(index, 'format')"
                      data-test="league-format"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="league.season"
                      label="Temporada"
                      :error-messages="leagueError(index, 'season')"
                      data-test="league-season"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="league.organizer"
                      label="Organizador"
                      :error-messages="leagueError(index, 'organizer')"
                      data-test="league-organizer"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="league.start_date"
                      label="Data de início"
                      type="date"
                      :error-messages="leagueError(index, 'start_date')"
                      data-test="league-start-date"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="league.end_date"
                      label="Data de término"
                      type="date"
                      :rules="[() => endAfterStart(league)]"
                      :error-messages="leagueError(index, 'end_date')"
                      data-test="league-end-date"
                    />
                  </v-col>
                </v-row>

                <div class="d-flex flex-wrap align-center ga-2">
                  <v-btn
                    v-if="league.id"
                    variant="text"
                    color="primary"
                    prepend-icon="mdi-view-dashboard-outline"
                    :to="{ name: 'admin-dashboard', params: { leagueId: league.id } }"
                    data-test="league-open"
                  >
                    Abrir painel da liga
                  </v-btn>
                  <v-spacer />
                  <v-btn
                    variant="text"
                    color="error"
                    prepend-icon="mdi-delete"
                    data-test="league-remove"
                    @click="removeLeague(league)"
                  >
                    Excluir liga
                  </v-btn>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
      </v-card>

      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" :to="{ name: 'admin-championships-list' }">Cancelar</v-btn>
        <v-btn type="submit" color="primary" :loading="loading" data-test="championship-submit"
          >Salvar</v-btn
        >
      </div>
    </v-form>

    <PasswordDeleteDialog
      v-model="deleteDialog"
      :title="`Excluir liga ${leagueToDelete?.name ?? ''}`"
      confirm-text="Excluir liga"
      warning="A exclusão é imediata e não depende do botão Salvar do formulário."
      :removed="LEAGUE_REMOVED"
      kept="Times, jogadores, comissão técnica e usuários continuam no sistema."
      :request="deleteLeague"
      @deleted="onLeagueDeleted"
    />

    <ChampionshipImagePreviewDialog
      v-if="imagePreview"
      v-model="previewDialog"
      :image="imagePreview"
      :name="form.name || 'Nome do campeonato'"
      :league-name="form.leagues[0]?.name || 'Nome da liga'"
    />
  </div>
</template>
