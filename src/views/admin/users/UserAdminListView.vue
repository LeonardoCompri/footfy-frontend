<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { usersService } from '@/services/api/users.service'
import type { User, UserPayload } from '@/types/user'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const { items, loading, errorMessage, fetchAll, destroy } = useCrud<User, UserPayload>(
  usersService,
)
const snackbar = useSnackbar()

const search = ref('')
const confirmDialog = ref(false)
const userToDelete = ref<User | null>(null)

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Documento', key: 'document' },
  { title: 'Email', key: 'email' },
  { title: 'Papel', key: 'roles' },
  { title: 'Ligas', key: 'leagues' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
]

function askDelete(user: User) {
  userToDelete.value = user
  confirmDialog.value = true
}

async function handleDelete() {
  if (!userToDelete.value) return
  const ok = await destroy(userToDelete.value.id)
  if (ok) {
    snackbar.success('Usuário excluído com sucesso.')
  } else {
    snackbar.error('Não foi possível excluir o usuário.')
  }
  userToDelete.value = null
}

onMounted(fetchAll)
</script>

<template>
  <div>
    <PageHeader title="Usuários">
      <template #action>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'admin-users-create' }">
          Novo Usuário
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Buscar"
          single-line
          hide-details
          class="mb-4"
        />
        <v-data-table :headers="headers" :items="items" :search="search" :loading="loading" item-value="id">
          <template v-slot:[`item.email`]="{ item }">{{ item.email ?? '—' }}</template>
          <template v-slot:[`item.roles`]="{ item }">{{ item.roles.join(', ') || '—' }}</template>
          <template v-slot:[`item.leagues`]="{ item }">{{ item.leagues.length }}</template>
          <template v-slot:[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :to="{ name: 'admin-users-edit', params: { id: item.id } }"
            />
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="confirmDialog"
      title="Excluir usuário"
      :message="`Tem certeza que deseja excluir '${userToDelete?.name}'?`"
      @confirm="handleDelete"
    />
  </div>
</template>
