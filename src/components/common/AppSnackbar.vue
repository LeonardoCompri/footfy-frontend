<script setup lang="ts">
import { useSnackbar } from '@/composables/useSnackbar'

const { visible, message, color } = useSnackbar()
</script>

<template>
  <v-snackbar v-model="visible" :color="color" timeout="4000" location="top right">
    {{ message }}
  </v-snackbar>
</template>
