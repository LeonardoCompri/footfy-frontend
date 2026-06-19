<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { stadiumsService } from '@/services/api/stadiums.service'
import type { Stadium, StadiumPayload } from '@/types/stadium'
import PageHeader from '@/components/common/PageHeader.vue'

const props = defineProps<{ id?: string }>()

const router = useRouter()
const { loading, errorMessage, fieldErrors, fetchOne, save } = useCrud<Stadium, StadiumPayload>(
  stadiumsService,
)
const snackbar = useSnackbar()

const isEditing = computed(() => !!props.id)
const pageTitle = computed(() => (isEditing.value ? 'Editar Estádio' : 'Novo Estádio'))
const initializing = ref(isEditing.value)

const form = reactive<StadiumPayload>({
  name: '',
  city: '',
  capacity: 0,
})

onMounted(async () => {
  if (!props.id) return
  try {
    const stadium = await fetchOne(props.id)
    if (stadium) {
      form.name = stadium.name
      form.city = stadium.city
      form.capacity = stadium.capacity
    }
  } finally {
    initializing.value = false
  }
})

async function handleSubmit() {
  const result = await save(form, props.id)
  if (result) {
    snackbar.success(isEditing.value ? 'Estádio atualizado com sucesso.' : 'Estádio criado com sucesso.')
    router.push({ name: 'admin-stadiums-list' })
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
            v-model="form.city"
            label="Cidade"
            :error-messages="fieldErrors.city"
            class="mb-2"
          />
          <v-text-field
            v-model.number="form.capacity"
            label="Capacidade"
            type="number"
            min="0"
            :error-messages="fieldErrors.capacity"
            class="mb-2"
          />

          <div class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" :to="{ name: 'admin-stadiums-list' }">Cancelar</v-btn>
            <v-btn type="submit" color="primary" :loading="loading">Salvar</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
