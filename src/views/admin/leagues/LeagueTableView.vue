<script setup lang="ts">
import { useLeagueContextStore } from '@/stores/leagueContext'
import { leaguesService } from '@/services/api/leagues.service'
import { LEAGUE_FORMAT_LABELS } from '@/types/championship'
import PageHeader from '@/components/common/PageHeader.vue'
import LeagueTablePanel from '@/components/leagues/LeagueTablePanel.vue'
import { bracketConfig } from '@/components/leagues/leagueKnockout'
import { groupQualifiers } from '@/components/leagues/standings'

const leagueContext = useLeagueContextStore()
const league = leagueContext.activeLeague
const leagueId = leagueContext.activeLeagueId as number
</script>

<template>
  <div>
    <PageHeader
      title="Tabela"
      :subtitle="[league?.name, league?.format ? LEAGUE_FORMAT_LABELS[league.format] : null].filter(Boolean).join(' · ')"
    />
    <LeagueTablePanel
      :format="league?.format"
      :qualifiers="groupQualifiers(league)"
      :bracket="bracketConfig(league)"
      :load="() => leaguesService.table(leagueId)"
    />
  </div>
</template>
