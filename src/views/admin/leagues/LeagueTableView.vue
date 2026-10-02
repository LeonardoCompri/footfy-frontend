<script setup lang="ts">
import { useLeagueContextStore } from '@/stores/leagueContext'
import { leaguesService } from '@/services/api/leagues.service'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import PageHeader from '@/components/common/PageHeader.vue'
import LeagueTablePanel from '@/components/leagues/LeagueTablePanel.vue'

const leagueContext = useLeagueContextStore()
// O layout remonta a tela ao trocar de liga, então a liga ativa é fixa aqui.
const league = leagueContext.activeLeague
const leagueId = leagueContext.activeLeagueId as number
</script>

<template>
  <div>
    <PageHeader
      title="Tabela"
      :subtitle="[league?.name, league?.format ? LEAGUE_FORMAT_LABELS[league.format] : null].filter(Boolean).join(' · ')"
    />
    <LeagueTablePanel :format="league?.format" :load="() => leaguesService.table(leagueId)" />
  </div>
</template>
