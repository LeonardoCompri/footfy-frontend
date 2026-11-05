<script setup lang="ts">
import { useDisplay } from 'vuetify'
import ChampionshipImage from '@/components/championships/ChampionshipImage.vue'

// Replica os tamanhos de imagem das telas reais (ChampionshipDetailView, ChampionshipCard,
// ChampionshipSelectView e DashboardView). Se algum mudar lá, ajuste aqui também.
defineProps<{
  modelValue: boolean
  image: string
  name: string
  leagueName: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { smAndDown } = useDisplay()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    :fullscreen="smAndDown"
    max-width="960"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card data-test="image-preview-dialog">
      <v-card-title class="text-wrap">Como a imagem aparece</v-card-title>

      <v-card-text>
        <div class="text-overline text-medium-emphasis">Área pública · página do campeonato</div>
        <v-card variant="outlined" class="mb-4" data-test="preview-banner">
          <ChampionshipImage :src="image" height="200" />
          <v-card-item>
            <v-card-title class="text-h4 text-wrap">{{ name }}</v-card-title>
          </v-card-item>
        </v-card>

        <v-row>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Área pública · lista</div>
            <v-card variant="outlined" data-test="preview-public-card">
              <ChampionshipImage :src="image" height="160" />
              <v-card-item>
                <v-card-title class="text-wrap">{{ name }}</v-card-title>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Admin · escolha do campeonato</div>
            <v-card variant="outlined" data-test="preview-select-card">
              <ChampionshipImage :src="image" height="140" />
              <v-card-item>
                <v-card-title class="text-wrap">{{ name }}</v-card-title>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Admin · topo do painel da liga</div>
            <v-card variant="outlined" data-test="preview-dashboard">
              <v-card-text class="d-flex align-center ga-4">
                <ChampionshipImage :src="image" width="56" height="56" rounded="lg" />
                <div class="overflow-hidden">
                  <div class="text-h5 font-weight-bold text-truncate">{{ leagueName }}</div>
                  <div class="text-medium-emphasis text-truncate">{{ name }}</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <p class="text-body-2 text-medium-emphasis mt-4">
          A imagem aparece inteira em todos os lugares; o espaço que sobra é preenchido com uma
          versão desfocada dela.
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          size="large"
          data-test="image-preview-close"
          @click="emit('update:modelValue', false)"
        >
          Fechar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
