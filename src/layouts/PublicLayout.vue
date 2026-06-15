<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <v-app>
    <v-app-bar color="primary" elevation="0">
      <v-container class="d-flex align-center">
        <RouterLink to="/" class="d-flex align-center text-white text-decoration-none">
          <v-icon icon="mdi-soccer" size="28" class="mr-2" />
          <span class="text-h6 font-weight-bold font-heading">Footfy</span>
        </RouterLink>

        <v-spacer />

        <v-btn variant="text" color="white" :to="{ name: 'home' }">Início</v-btn>
        <v-btn variant="text" color="white" :to="{ name: 'championships-list' }">Campeonatos</v-btn>

        <v-btn
          v-if="authStore.isAuthenticated"
          variant="elevated"
          class="text-primary ml-2"
          :to="{ name: 'admin-dashboard' }"
        >
          Painel Admin
        </v-btn>
        <v-btn v-else variant="elevated" class="text-primary ml-2" :to="{ name: 'login' }"> Entrar </v-btn>
      </v-container>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>

    <v-footer color="primary" class="d-flex flex-column align-center py-6">
      <div class="d-flex align-center mb-2">
        <v-icon icon="mdi-soccer" class="mr-2" />
        <span class="text-subtitle-1 font-weight-bold font-heading">Footfy</span>
      </div>
      <span class="text-white text-caption" style="opacity: 0.8">
        &copy; {{ new Date().getFullYear() }} Footfy — Gestão de campeonatos de futebol
      </span>
    </v-footer>
  </v-app>
</template>
