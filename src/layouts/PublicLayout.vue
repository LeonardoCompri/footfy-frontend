<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, type RouteRecordNameGeneric } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/stores/auth'
import logoWhite from '@/assets/brand/futy-mono-branco.svg'

const authStore = useAuthStore()
const route = useRoute()
// "Campeonatos" é a única entrada do menu para as telas públicas: fica ativo também nas que se
// abrem a partir dele (liga, time, partida). Precisa de `:active` porque o link só casaria a lista.
const CHAMPIONSHIPS_ROUTES = new Set<RouteRecordNameGeneric>([
  'championships-list',
  'championships-detail',
  'leagues-detail',
  'teams-detail',
  'games-detail',
])
const championshipsActive = computed(() => CHAMPIONSHIPS_ROUTES.has(route.name))
// No xs os botões com texto não cabem no app bar: "Início" some (o logo já leva para a home)
// e "Campeonatos" vira ícone.
const { xs } = useDisplay()
</script>

<template>
  <v-app>
    <v-app-bar color="primary" elevation="0">
      <v-container class="d-flex align-center">
        <RouterLink to="/" class="d-flex align-center">
          <img :src="logoWhite" alt="Futy" height="40" class="d-block" />
        </RouterLink>

        <v-spacer />

        <v-btn
          v-if="xs"
          icon="mdi-trophy"
          variant="text"
          color="white"
          aria-label="Campeonatos"
          :to="{ name: 'championships-list' }"
          :active="championshipsActive"
          :aria-current="championshipsActive ? 'page' : undefined"
        />
        <template v-else>
          <!-- `exact`: a home é filha de path vazio e ficaria ativa em toda tela (BUG-036). -->
          <v-btn variant="text" color="white" exact :to="{ name: 'home' }">Início</v-btn>
          <v-btn
            variant="text"
            color="white"
            :to="{ name: 'championships-list' }"
            :active="championshipsActive"
            :aria-current="championshipsActive ? 'page' : undefined"
          >
            Campeonatos
          </v-btn>
        </template>

        <v-btn
          v-if="authStore.isAuthenticated"
          variant="elevated"
          class="text-primary ml-2"
          :to="{ name: 'admin-home' }"
        >
          {{ xs ? 'Painel' : 'Painel Admin' }}
        </v-btn>
        <v-btn v-else variant="elevated" class="text-primary ml-2" :to="{ name: 'login' }"> Entrar </v-btn>
      </v-container>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>

    <v-footer color="primary" class="d-flex flex-column align-center py-6">
      <img :src="logoWhite" alt="Futy" height="56" class="d-block mb-2" />
      <span class="text-white text-caption" style="opacity: 0.8">
        &copy; {{ new Date().getFullYear() }} Futy — Gestão de campeonatos de futebol
      </span>
    </v-footer>
  </v-app>
</template>
