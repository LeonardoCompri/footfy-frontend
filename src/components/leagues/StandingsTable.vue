<script setup lang="ts">
import type { StandingRow } from '@/types/leagueStats'

defineProps<{ rows: StandingRow[] }>()

function initials(row: StandingRow): string {
  return (row.team.nickname || row.team.name).slice(0, 2).toUpperCase()
}
</script>

<template>
  <v-card>
    <v-card-text v-if="rows.length === 0" class="text-medium-emphasis text-center">
      Nenhum time vinculado a esta liga ainda.
    </v-card-text>
    <template v-else>
      <v-table density="comfortable" data-test="standings-table">
        <thead>
          <tr>
            <th class="text-center pos">#</th>
            <th>Time</th>
            <th class="text-center">P</th>
            <th class="text-center">J</th>
            <th class="text-center d-none d-sm-table-cell">V</th>
            <th class="text-center d-none d-sm-table-cell">E</th>
            <th class="text-center d-none d-sm-table-cell">D</th>
            <th class="text-center d-none d-md-table-cell">GP</th>
            <th class="text-center d-none d-md-table-cell">GC</th>
            <th class="text-center">SG</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.team_id" data-test="standings-row">
            <td class="text-center pos font-weight-bold">{{ index + 1 }}</td>
            <td>
              <div class="d-flex align-center ga-2 team-cell">
                <v-avatar size="28" rounded="lg" color="primary" variant="tonal">
                  <v-img v-if="row.team.logo" :src="row.team.logo" cover data-test="team-logo" />
                  <span v-else class="text-caption font-weight-bold">{{ initials(row) }}</span>
                </v-avatar>
                <span class="text-truncate">
                  <span class="d-sm-none">{{ row.team.nickname || row.team.name }}</span>
                  <span class="d-none d-sm-inline">{{ row.team.name }}</span>
                </span>
              </div>
            </td>
            <td class="text-center font-weight-bold tabular">{{ row.points }}</td>
            <td class="text-center tabular">{{ row.played }}</td>
            <td class="text-center tabular d-none d-sm-table-cell">{{ row.wins }}</td>
            <td class="text-center tabular d-none d-sm-table-cell">{{ row.draws }}</td>
            <td class="text-center tabular d-none d-sm-table-cell">{{ row.losses }}</td>
            <td class="text-center tabular d-none d-md-table-cell">{{ row.goals_for }}</td>
            <td class="text-center tabular d-none d-md-table-cell">{{ row.goals_against }}</td>
            <td class="text-center tabular">{{ row.goal_difference }}</td>
          </tr>
        </tbody>
      </v-table>
      <v-card-text class="text-caption text-medium-emphasis pt-2">
        P pontos · J jogos · V vitórias · E empates · D derrotas · GP gols pró · GC gols contra · SG saldo de gols.
        Desempate: vitórias, saldo, gols pró, confronto direto e cartões.
      </v-card-text>
    </template>
  </v-card>
</template>

<style scoped>
.pos {
  width: 40px;
}
.team-cell {
  min-width: 0;
  max-width: 280px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
</style>
