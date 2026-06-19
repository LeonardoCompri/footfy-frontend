<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { championshipsService } from '@/services/api/championships.service'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import PageHeader from '@/components/common/PageHeader.vue'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<
  Championship,
  ChampionshipPayload
>(championshipsService)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Campeonato' : 'Novo Campeonato'))
const initializing = ref(isEditing.value)

const form = reactive<ChampionshipPayload>({
  name: '',
  organizer: null,
  start_date: null,
  end_date: null,
})

onMounted(async () => {
  if (!props.id) return
  try {
    const championship = await fetchOne(props.id)
    if (championship) {
      form.name = championship.name
      form.organizer = championship.organizer
      form.start_date = championship.start_date
      form.end_date = championship.end_date
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit() {
  const result = await save(form, props.id)
  if (result) {
    snackbar.success(
      isEditing.value ? 'Campeonato atualizado com sucesso.' : 'Campeonato criado com sucesso.',
    )
    router.push({ name: 'admin-championships-list' })
  }
}
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" />

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text v-if="initializing" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
      <v-card-text v-else>
        <v-form @submit.prevent="handleSubmit">
          <v-text-field
            v-model="form.name"
            label="Nome"
            :error-messages="fieldErrors.name"
            class="mb-2"
          />
          <v-text-field
            v-model="form.organizer"
            label="Organizador"
            :error-messages="fieldErrors.organizer"
            class="mb-2"
          />
          <v-text-field
            v-model="form.start_date"
            label="Data de início"
            type="date"
            :error-messages="fieldErrors.start_date"
            class="mb-2"
          />
          <v-text-field
            v-model="form.end_date"
            label="Data de término"
            type="date"
            :error-messages="fieldErrors.end_date"
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-championships-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading">Salvar</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
