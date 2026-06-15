<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-2">Olá, {{ authStore.user?.name }}!</h1>
    <p class="text-medium-emphasis">Bem-vindo ao painel administrativo do Footfy.</p>
  </div>
</template>
