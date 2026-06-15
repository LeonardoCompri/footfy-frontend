<script setup lang="ts">
import { onMounted } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { championshipsService } from '@/services/api/championships.service'
import type { Championship, ChampionshipPayload } from '@/types/championship'
import ChampionshipCard from '@/components/championships/ChampionshipCard.vue'

const { items, loading, fetchAll } = useCrud<Championship, ChampionshipPayload>(
  championshipsService,
)

const highlights = [
  {
    icon: 'mdi-trophy-variant-outline',
    title: 'Campeonatos',
    text: 'Acompanhe fases, classificação e resultados de cada competição em um só lugar.',
  },
  {
    icon: 'mdi-shield-account-outline',
    title: 'Times e elencos',
    text: 'Conheça os times participantes, seus jogadores e comissões técnicas.',
  },
  {
    icon: 'mdi-soccer-field',
    title: 'Jogos e resultados',
    text: 'Veja datas, estádios e placares de todas as partidas dos campeonatos.',
  },
  {
    icon: 'mdi-soccer',
    title: 'Artilharia',
    text: 'Descubra os goleadores e as principais estatísticas de cada edição.',
  },
]

onMounted(fetchAll)
</script>

<template>
  <div>
    <section class="hero">
      <div class="hero-pattern" />
      <v-icon icon="mdi-soccer-field" class="hero-icon" />
      <v-container class="hero-content">
        <v-row>
          <v-col cols="12" md="9" lg="7">
            <v-chip
              color="secondary"
              variant="flat"
              class="font-weight-bold mb-4"
              prepend-icon="mdi-soccer"
            >
              Gestão de campeonatos de futebol
            </v-chip>
            <h1 class="hero-title font-heading mb-4">
              Organize. Acompanhe.<br />
              <span class="text-secondary">Comemore.</span>
            </h1>
            <p class="hero-subtitle mb-8">
              O Footfy reúne campeonatos, times, jogos e artilharia em um só lugar — para
              organizadores e para quem só quer acompanhar o jogo.
            </p>
            <div class="d-flex flex-wrap ga-4">
              <v-btn
                size="x-large"
                color="secondary"
                rounded="lg"
                class="font-weight-bold"
                prepend-icon="mdi-trophy"
                :to="{ name: 'championships-list' }"
              >
                Ver campeonatos
              </v-btn>
              <v-btn
                size="x-large"
                variant="outlined"
                class="text-white"
                rounded="lg"
                prepend-icon="mdi-shield-lock-outline"
                :to="{ name: 'login' }"
              >
                Acessar painel
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section class="py-12">
      <v-container>
        <v-row>
          <v-col v-for="item in highlights" :key="item.title" cols="12" sm="6" md="3">
            <v-card variant="flat" class="highlight-card h-100 pa-6" rounded="lg">
              <v-avatar color="primary" variant="tonal" size="56" class="mb-4">
                <v-icon :icon="item.icon" size="28" />
              </v-avatar>
              <h3 class="text-h6 font-weight-bold font-heading mb-2">{{ item.title }}</h3>
              <p class="text-body-2 text-medium-emphasis">{{ item.text }}</p>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section class="py-12 bg-grey-lighten-4">
      <v-container>
        <div class="d-flex flex-wrap align-center justify-space-between mb-6 ga-4">
          <div>
            <h2 class="text-h4 font-weight-bold font-heading">Campeonatos em destaque</h2>
            <p class="text-medium-emphasis">Confira as competições cadastradas na plataforma.</p>
          </div>
          <v-btn
            variant="text"
            color="primary"
            append-icon="mdi-arrow-right"
            :to="{ name: 'championships-list' }"
          >
            Ver todos
          </v-btn>
        </div>

        <v-row v-if="loading">
          <v-col cols="12" class="text-center py-8">
            <v-progress-circular indeterminate color="primary" />
          </v-col>
        </v-row>

        <v-row v-else-if="items.length === 0">
          <v-col cols="12">
            <v-alert type="info" variant="tonal" rounded="lg">
              Nenhum campeonato cadastrado ainda. Volte em breve!
            </v-alert>
          </v-col>
        </v-row>

        <v-row v-else>
          <v-col
            v-for="championship in items.slice(0, 3)"
            :key="championship.id"
            cols="12"
            sm="6"
            md="4"
          >
            <ChampionshipCard :championship="championship" />
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section class="py-12">
      <v-container>
        <v-card class="cta-card text-center pa-8 pa-md-12" rounded="xl">
          <h2 class="text-h4 font-weight-bold font-heading text-white mb-3">
            Pronto para entrar em campo?
          </h2>
          <p class="text-white text-body-1 mb-6 mx-auto cta-subtitle">
            Explore os campeonatos cadastrados ou acesse o painel administrativo para gerenciar
            times, jogos e muito mais.
          </p>
          <div class="d-flex flex-wrap justify-center ga-4">
            <v-btn
              size="large"
              color="secondary"
              rounded="lg"
              class="font-weight-bold"
              :to="{ name: 'championships-list' }"
            >
              Explorar campeonatos
            </v-btn>
            <v-btn size="large" variant="outlined" class="text-white" rounded="lg" :to="{ name: 'login' }">
              Entrar
            </v-btn>
          </div>
        </v-card>
      </v-container>
    </section>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #1b5e20 0%, #0a3d12 60%, #062b0c 100%);
  color: #fff;
  padding: 96px 0;
}

.hero-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.hero-icon {
  position: absolute;
  right: -60px;
  bottom: -80px;
  font-size: 420px !important;
  color: rgba(255, 255, 255, 0.05);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 800;
  line-height: 1.15;
}

.hero-subtitle {
  font-size: 1.125rem;
  max-width: 560px;
  color: rgba(255, 255, 255, 0.85);
}

.highlight-card {
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.highlight-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.cta-card {
  background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%);
}

.cta-subtitle {
  max-width: 560px;
  opacity: 0.9;
}

@media (max-width: 600px) {
  .hero {
    padding: 64px 0;
  }
}
</style>
