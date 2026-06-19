<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCrud } from '@/composables/useCrud'
import { championshipsService } from '@/services/api/championships.service'
import { teamsService } from '@/services/api/teams.service'
import { playersService } from '@/services/api/players.service'
import { stadiumsService } from '@/services/api/stadiums.service'
import PageHeader from '@/components/common/PageHeader.vue'
import StatCard from '@/components/common/StatCard.vue'

const authStore = useAuthStore()

const championships = useCrud(championshipsService)
const teams = useCrud(teamsService)
const players = useCrud(playersService)
const stadiums = useCrud(stadiumsService)

const stats = [
  {
    label: 'Campeonatos',
    icon: 'mdi-trophy',
    color: 'primary',
    permission: 'tournament:read',
    crud: championships,
  },
  {
    label: 'Times',
    icon: 'mdi-shield',
    color: 'info',
    permission: 'team:read',
    crud: teams,
  },
  {
    label: 'Jogadores',
    icon: 'mdi-account-group',
    color: 'success',
    permission: 'player:read',
    crud: players,
  },
  {
    label: 'Estádios',
    icon: 'mdi-stadium',
    color: 'secondary',
    permission: 'stadium:read',
    crud: stadiums,
  },
].filter((stat) => authStore.hasPermission(stat.permission))

onMounted(() => {
  stats.forEach((stat) => stat.crud.fetchAll())
})
</script>

<template>
  <div>
    <PageHeader title="Dashboard" :subtitle="`Olá, ${authStore.user?.name}! Bem-vindo ao painel administrativo do Footfy.`" />

    <v-row>
      <v-col v-for="stat in stats" :key="stat.label" cols="12" sm="6" md="3">
        <StatCard
          :icon="stat.icon"
          :label="stat.label"
          :value="stat.crud.loading.value ? '—' : stat.crud.items.value.length"
          :color="stat.color"
        />
      </v-col>
    </v-row>
  </div>
</template>
