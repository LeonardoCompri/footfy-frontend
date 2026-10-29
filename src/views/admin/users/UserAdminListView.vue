<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useCrud } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { usersService } from '@/services/api/users.service'
import { userRoleOption } from '@/types/user'
import { cpfDigits, formatCpf } from '@/components/common/format'
import type { User, UserPayload } from '@/types/user'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
import UserFormDialog from '@/components/users/UserFormDialog.vue'
import UserLeaguesDialog from '@/components/users/UserLeaguesDialog.vue'

const authStore = useAuthStore()
const snackbar = useSnackbar()
const { xs, smAndDown } = useDisplay()
const { items, loading, errorMessage, fetchAll, destroy } = useCrud<User, UserPayload>(usersService)

// Regra do backend (routes/backoffice.php): master|admin listam e criam (admin só coach e
// player); excluir e vincular ligas é só master. Admin edita só a si mesmo e coach/player
// (access:user_write — nunca master nem outro admin, ver BUG-012).
const isMaster = authStore.hasRole('master')
const currentUserId = authStore.user?.id

// Coach e player herdam as ligas do time vinculado (não usam vínculo manual de ligas).
function isTeamScoped(user: User): boolean {
  return (
    user.roles.some((role) => role === 'coach' || role === 'player') &&
    !user.roles.some((role) => role === 'master' || role === 'admin')
  )
}

const can = {
  create: isMaster || authStore.hasRole('admin'),
  edit: (user: User) => isMaster || user.id === currentUserId || isTeamScoped(user),
  leagues: (user: User) => isMaster && !user.roles.includes('master') && !isTeamScoped(user),
  delete: (user: User) => isMaster && user.id !== currentUserId,
}

const search = ref('')
const formDialog = ref(false)
const userToEdit = ref<User | null>(null)
const leaguesDialog = ref(false)
const leaguesUser = ref<User | null>(null)
const { open: confirmOpen, target: userToDelete, ask: askDelete } = useConfirmDialog<User>()

// Termo "com cara de CPF" (só dígitos, ponto, hífen, espaço): compara pelos dígitos.
const CPF_LIKE = /^[\d.\-\s]+$/

const filteredUsers = computed(() => {
  const term = search.value?.trim().toLocaleLowerCase('pt-BR') ?? ''
  if (!term) return items.value
  const digits = CPF_LIKE.test(term) ? cpfDigits(term) : ''
  return items.value.filter(
    (user) =>
      [user.name, user.email ?? ''].some((text) =>
        text.toLocaleLowerCase('pt-BR').includes(term),
      ) ||
      (digits !== '' && cpfDigits(user.document).includes(digits)),
  )
})

// E-mail e CPF ficam sempre como legenda sob o nome (sem coluna própria); no mobile Papel e,
// abaixo de 960px, Ligas/Vínculo também viram legenda, para caber sem rolagem horizontal.
// Ações com padding menor: em 960px com o menu lateral aberto a tabela fica no limite.
const headers = computed(() => [
  { title: 'Nome', key: 'name' },
  ...(xs.value ? [] : [{ title: 'Papel', key: 'roles', sortable: false }]),
  ...(smAndDown.value ? [] : [{ title: 'Ligas', key: 'leagues', sortable: false }]),
  ...(smAndDown.value ? [] : [{ title: 'Vínculo', key: 'link', sortable: false }]),
  {
    title: '',
    key: 'actions',
    sortable: false,
    align: 'end' as const,
    headerProps: { class: 'px-2' },
    cellProps: { class: 'px-2' },
  },
])

function leaguesLabel(user: User): string {
  if (user.roles.includes('master')) return 'Todas as ligas'
  if (isTeamScoped(user)) return user.team ? 'Ligas do time' : 'Nenhuma liga'
  if (user.leagues.length === 0) return 'Nenhuma liga'
  return user.leagues.map((league) => league.name).join(', ')
}

// Time do coach ou jogador (com o time) do player; '' para quem não tem vínculo por papel.
function linkLabel(user: User): string {
  if (user.roles.includes('coach')) return user.team ? `Time: ${user.team.name}` : 'Sem time'
  if (user.roles.includes('player')) {
    if (!user.player) return 'Sem jogador'
    return user.team ? `Jogador: ${user.player.name} (${user.team.name})` : `Jogador: ${user.player.name}`
  }
  return ''
}

function rowActions(user: User): RowAction[] {
  const actions: RowAction[] = []
  if (can.leagues(user)) {
    actions.push({
      key: 'leagues',
      icon: 'mdi-link-variant',
      label: 'Ligas do usuário',
      dataTest: 'user-leagues-open',
      onClick: () => openLeagues(user),
    })
  }
  if (can.edit(user)) {
    actions.push({
      key: 'edit',
      icon: 'mdi-pencil',
      label: 'Editar usuário',
      dataTest: 'user-edit',
      onClick: () => openForm(user),
    })
  }
  if (can.delete(user)) {
    actions.push({
      key: 'delete',
      icon: 'mdi-delete',
      label: 'Excluir usuário',
      color: 'error',
      dataTest: 'user-delete',
      onClick: () => askDelete(user),
    })
  }
  return actions
}

function replaceUser(user: User) {
  const index = items.value.findIndex((item) => item.id === user.id)
  if (index === -1) items.value.push(user)
  else items.value[index] = user
  if (leaguesUser.value?.id === user.id) leaguesUser.value = user
}

function openForm(user: User | null) {
  userToEdit.value = user
  formDialog.value = true
}

function openLeagues(user: User) {
  leaguesUser.value = user
  leaguesDialog.value = true
}

async function handleDelete() {
  if (!userToDelete.value) return
  if (await destroy(userToDelete.value.id)) {
    snackbar.success('Usuário excluído com sucesso.')
  } else {
    snackbar.error(errorMessage.value ?? 'Não foi possível excluir o usuário.')
    errorMessage.value = null
  }
  userToDelete.value = null
}

onMounted(() => fetchAll())
</script>

<template>
  <div>
    <PageHeader title="Usuários">
      <template #action>
        <v-btn v-if="can.create" color="primary" prepend-icon="mdi-plus" data-test="user-create" @click="openForm(null)">
          <span class="d-none d-sm-inline">Novo usuário</span>
          <span class="d-sm-none">Novo</span>
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card>
      <v-card-text>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Buscar por nome, CPF ou e-mail"
          single-line
          hide-details
          clearable
          class="mb-4"
          data-test="users-search"
        />
        <v-data-table
          :headers="headers"
          :items="filteredUsers"
          :loading="loading"
          item-value="id"
          no-data-text="Nenhum usuário encontrado."
          data-test="users-table"
        >
          <template v-slot:[`item.name`]="{ item }">
            <div class="py-2">
              <div class="font-weight-medium">{{ item.name }}</div>
              <div v-if="xs" class="text-caption text-medium-emphasis">
                {{ userRoleOption(item.roles[0]).title }} ·
                <span class="text-no-wrap" data-test="user-cpf">{{
                  formatCpf(item.document)
                }}</span>
              </div>
              <template v-else>
                <div v-if="item.email" class="text-caption text-medium-emphasis text-break">
                  {{ item.email }}
                </div>
                <div class="text-caption text-medium-emphasis text-no-wrap" data-test="user-cpf">
                  {{ formatCpf(item.document) }}
                </div>
              </template>
              <div v-if="smAndDown" class="text-caption text-medium-emphasis">{{ leaguesLabel(item) }}</div>
              <div v-if="smAndDown && linkLabel(item)" class="text-caption text-medium-emphasis">
                {{ linkLabel(item) }}
              </div>
            </div>
          </template>
          <template v-slot:[`item.roles`]="{ item }">
            <v-chip :color="userRoleOption(item.roles[0]).color" size="small" variant="tonal">
              {{ userRoleOption(item.roles[0]).title }}
            </v-chip>
          </template>
          <template v-slot:[`item.leagues`]="{ item }">
            <span class="text-body-2">{{ leaguesLabel(item) }}</span>
          </template>
          <template v-slot:[`item.link`]="{ item }">
            <span class="text-body-2" data-test="user-link">{{ linkLabel(item) || '—' }}</span>
          </template>
          <template v-slot:[`item.actions`]="{ item }">
            <RowActions :actions="rowActions(item)" :menu-label="`Ações de ${item.name}`" />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <UserFormDialog v-model="formDialog" :user="userToEdit" @saved="replaceUser" />
    <UserLeaguesDialog v-if="leaguesUser" v-model="leaguesDialog" :user="leaguesUser" @updated="replaceUser" />
    <ConfirmDialog
      v-model="confirmOpen"
      title="Excluir usuário"
      :message="`Tem certeza que deseja excluir '${userToDelete?.name}'? O acesso ao painel é removido na hora.`"
      @confirm="handleDelete"
    />
  </div>
</template>
