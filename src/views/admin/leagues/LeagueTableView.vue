<script setup lang="ts">
import { useLeagueContextStore } from '@/stores/leagueContext'
import PageHeader from '@/components/common/PageHeader.vue'

const leagueContext = useLeagueContextStore()
</script>

<template>
  <div>
    <PageHeader title="Tabela" :subtitle="leagueContext.activeLeague?.name" />
    <!-- TODO(FOOT-0024): consumir GET /leagues/{id}/table (classificação/chaveamento por formato). -->
    <v-alert type="info">Tabela da liga em breve.</v-alert>
  </div>
</template>
