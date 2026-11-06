<script setup lang="ts">
import { useLeagueContextStore } from '@/stores/leagueContext'
import { leaguesService } from '@/services/api/leagues.service'
import PageHeader from '@/components/common/PageHeader.vue'
import LeagueStatisticsPanel from '@/components/leagues/LeagueStatisticsPanel.vue'

const leagueContext = useLeagueContextStore()
const leagueId = leagueContext.activeLeagueId as number
</script>

<template>
  <div>
    <PageHeader title="Estatísticas" :subtitle="leagueContext.activeLeague?.name" />
    <LeagueStatisticsPanel :load="() => leaguesService.statistics(leagueId)" />
  </div>
</template>
