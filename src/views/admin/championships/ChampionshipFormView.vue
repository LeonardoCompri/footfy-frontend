<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
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

const form = reactive({
  name: '',
})

// v-file-input tipa o modelValue como File | File[] | null; normalizamos para
// um único File antes de enviar no payload.
const selectedFile = ref<File | File[] | null>(null)
const existingImageUrl = ref<string | null>(null)
const newImageObjectUrl = ref<string | null>(null)
const imagePreview = computed(() => newImageObjectUrl.value ?? existingImageUrl.value)

watch(selectedFile, (value) => {
  if (newImageObjectUrl.value) {
    URL.revokeObjectURL(newImageObjectUrl.value)
    newImageObjectUrl.value = null
  }
  const file = Array.isArray(value) ? value[0] : value
  if (file) {
    newImageObjectUrl.value = URL.createObjectURL(file)
  }
})

onBeforeUnmount(() => {
  if (newImageObjectUrl.value) {
    URL.revokeObjectURL(newImageObjectUrl.value)
  }
})

onMounted(async () => {
  if (!props.id) return
  try {
    const championship = await fetchOne(props.id)
    if (championship) {
      form.name = championship.name
      existingImageUrl.value = championship.image
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit() {
  const file = Array.isArray(selectedFile.value) ? selectedFile.value[0] : selectedFile.value
  const payload: ChampionshipPayload = { name: form.name, image: file ?? null }
  const result = await save(payload, props.id)
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

          <v-img
            v-if="imagePreview"
            :src="imagePreview"
            height="160"
            width="160"
            contain
            class="mb-2 bg-grey-lighten-3"
          />

          <v-file-input
            v-model="selectedFile"
            label="Imagem"
            accept="image/*"
            prepend-icon="mdi-image"
            :error-messages="fieldErrors.image"
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
