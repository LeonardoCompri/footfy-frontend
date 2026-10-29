<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { AxiosError } from 'axios'
import type { SubmitEventPromise } from 'vuetify'
import { extractErrorMessage } from '@/composables/useCrud'
import { useSnackbar } from '@/composables/useSnackbar'
import { playersService } from '@/services/api/players.service'
import { profileService } from '@/services/api/profile.service'
import { useAuthStore } from '@/stores/auth'
import { formatCpf } from '@/components/common/format'
import type { ApiErrorResponse } from '@/types/api'
import type { ProfilePayload } from '@/types/profile'
import type { User } from '@/types/user'
import PageHeader from '@/components/common/PageHeader.vue'

const authStore = useAuthStore()
const snackbar = useSnackbar()

// O bloco de jogador depende só do papel: o player removido do elenco vem com `player: null`
// no /me, e o motivo (removido ou sem vínculo) só aparece ao salvar.
const isPlayer = authStore.hasRole('player')
const initializing = ref(true)
const loadError = ref<string | null>(null)
const cpf = ref('')
const showPassword = ref(false)

const account = reactive({ name: '', email: '', password: '', password_confirmation: '' })
const player = reactive({ name: '', birth_date: '' })

// Cada bloco tem o próprio estado de envio e de erros da API.
function useSubmitState() {
  const state = reactive({
    loading: false,
    errorMessage: null as string | null,
    fieldErrors: {} as Record<string, string[]>,
  })

  async function run<R>(request: () => Promise<R>): Promise<R | null> {
    state.loading = true
    state.errorMessage = null
    state.fieldErrors = {}
    try {
      return await request()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>
      if (axiosErr.response?.status === 422) {
        state.fieldErrors = axiosErr.response.data?.errors ?? {}
      }
      state.errorMessage = extractErrorMessage(err)
      return null
    } finally {
      state.loading = false
    }
  }

  return { state, run }
}

const { state: accountState, run: runAccount } = useSubmitState()
const { state: playerState, run: runPlayer } = useSubmitState()

const required = (value: string) => !!value?.trim() || 'Campo obrigatório.'
const maxLength = (value: string) => (value ?? '').length <= 255 || 'Máximo de 255 caracteres.'
const validEmail = (value: string) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Informe um e-mail válido.'
const minPassword = (value: string) =>
  !value || value.length >= 6 || 'A senha deve ter no mínimo 6 caracteres.'
const matchesPassword = (value: string) =>
  value === account.password || 'A confirmação da senha não confere.'

function toDateInput(date: string | null): string {
  return date?.slice(0, 10) ?? ''
}

async function loadProfile() {
  let me: User | null = null
  try {
    me = await profileService.get()
  } catch (err) {
    loadError.value = extractErrorMessage(err)
  }
  // Sem o /me a tela segue com os dados da sessão.
  const source = me ?? authStore.user
  account.name = source?.name ?? ''
  account.email = source?.email ?? ''
  cpf.value = formatCpf(source?.document)

  const linked = source?.player
  if (!isPlayer || !linked) return
  player.name = linked.name
  // O /me não traz o nascimento: vem da ficha do jogador. Se falhar, o campo fica vazio.
  try {
    const data = await playersService.get(linked.id)
    player.name = data.name
    player.birth_date = toDateInput(data.birth_date)
  } catch {
    player.birth_date = ''
  }
}

onMounted(async () => {
  try {
    await loadProfile()
  } finally {
    initializing.value = false
  }
})

async function submitAccount(event: SubmitEventPromise) {
  const { valid } = await event
  if (!valid) return
  const payload: ProfilePayload = { name: account.name, email: account.email || null }
  // Senha em branco mantém a atual: só vai no payload quando preenchida.
  if (account.password) {
    payload.password = account.password
    payload.password_confirmation = account.password_confirmation
  }
  const user = await runAccount(() => profileService.update(payload))
  if (!user) return
  authStore.updateUser({ name: user.name, email: user.email })
  account.name = user.name
  account.email = user.email ?? ''
  account.password = ''
  account.password_confirmation = ''
  snackbar.success('Dados da conta atualizados com sucesso.')
}

async function submitPlayer(event: SubmitEventPromise) {
  const { valid } = await event
  if (!valid) return
  const result = await runPlayer(() =>
    profileService.updatePlayer({ name: player.name, birth_date: player.birth_date || null }),
  )
  if (!result) return
  player.name = result.name
  player.birth_date = toDateInput(result.birth_date)
  const linked = authStore.user?.player
  if (linked) authStore.updateUser({ player: { ...linked, name: result.name } })
  snackbar.success('Dados de jogador atualizados com sucesso.')
}
</script>

<template>
  <div>
    <PageHeader title="Meu perfil" subtitle="Dados da sua conta de acesso ao painel." />

    <v-card v-if="initializing">
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
    </v-card>

    <template v-else>
      <v-alert v-if="loadError" type="warning" variant="tonal" class="mb-4" data-test="load-error">
        {{ loadError }}
      </v-alert>

      <v-row>
        <v-col cols="12" :md="isPlayer ? 6 : 8" lg="6">
          <v-card data-test="account-card">
            <v-card-title>Conta</v-card-title>
            <v-form @submit.prevent="submitAccount">
              <v-card-text>
                <v-alert
                  v-if="accountState.errorMessage"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                  data-test="account-error"
                >
                  {{ accountState.errorMessage }}
                </v-alert>
                <v-text-field
                  v-model="account.name"
                  label="Nome"
                  autocomplete="name"
                  :rules="[required, maxLength]"
                  :error-messages="accountState.fieldErrors.name"
                  data-test="account-name"
                />
                <v-text-field
                  v-model="account.email"
                  label="E-mail"
                  type="email"
                  autocomplete="email"
                  :rules="[validEmail]"
                  :error-messages="accountState.fieldErrors.email"
                  data-test="account-email"
                />
                <v-text-field
                  :model-value="cpf"
                  label="CPF"
                  readonly
                  hint="O CPF não pode ser alterado."
                  persistent-hint
                  class="mb-2"
                  data-test="account-document"
                />
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="account.password"
                      label="Nova senha"
                      :type="showPassword ? 'text' : 'password'"
                      :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                      hint="Deixe em branco para manter a senha atual"
                      persistent-hint
                      autocomplete="new-password"
                      :rules="[minPassword]"
                      :error-messages="accountState.fieldErrors.password"
                      data-test="account-password"
                      @click:append-inner="showPassword = !showPassword"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="account.password_confirmation"
                      label="Confirmar nova senha"
                      :type="showPassword ? 'text' : 'password'"
                      autocomplete="new-password"
                      :rules="[matchesPassword]"
                      :error-messages="accountState.fieldErrors.password_confirmation"
                      data-test="account-password-confirmation"
                    />
                  </v-col>
                </v-row>
              </v-card-text>
              <v-card-actions class="px-4 pb-4">
                <v-spacer />
                <v-btn
                  type="submit"
                  color="primary"
                  variant="flat"
                  :loading="accountState.loading"
                  data-test="account-submit"
                >
                  Salvar
                </v-btn>
              </v-card-actions>
            </v-form>
          </v-card>
        </v-col>

        <v-col v-if="isPlayer" cols="12" md="6">
          <v-card data-test="player-card">
            <v-card-title>Meus dados de jogador</v-card-title>
            <v-card-subtitle class="text-wrap">
              Como você aparece no elenco, na súmula e nas estatísticas.
            </v-card-subtitle>
            <v-form @submit.prevent="submitPlayer">
              <v-card-text>
                <v-alert
                  v-if="playerState.errorMessage"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                  data-test="player-error"
                >
                  {{ playerState.errorMessage }}
                </v-alert>
                <v-text-field
                  v-model="player.name"
                  label="Nome do jogador"
                  :rules="[required, maxLength]"
                  :error-messages="playerState.fieldErrors.name"
                  data-test="player-name"
                />
                <v-text-field
                  v-model="player.birth_date"
                  label="Data de nascimento"
                  type="date"
                  :error-messages="playerState.fieldErrors.birth_date"
                  data-test="player-birth-date"
                />
              </v-card-text>
              <v-card-actions class="px-4 pb-4">
                <v-spacer />
                <v-btn
                  type="submit"
                  color="primary"
                  variant="flat"
                  :loading="playerState.loading"
                  data-test="player-submit"
                >
                  Salvar
                </v-btn>
              </v-card-actions>
            </v-form>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
