<script setup lang="ts">
import { useLeagueContextStore } from '@/stores/leagueContext'
import PageHeader from '@/components/common/PageHeader.vue'

const leagueContext = useLeagueContextStore()
</script>

<template>
  <div>
    <PageHeader title="Estatísticas" :subtitle="leagueContext.activeLeague?.name" />
    <!-- TODO(FOOT-0024): consumir GET /leagues/{id}/statistics (artilharia/assistências/cartões). -->
    <v-alert type="info">Estatísticas da liga em breve.</v-alert>
  </div>
</template>
