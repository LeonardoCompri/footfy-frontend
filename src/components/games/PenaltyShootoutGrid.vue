<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TeamSide } from '@/types/gameEvent'
import {
  draftResult,
  REGULATION_KICKS,
  shootoutColumns,
  type ShootoutGridKick,
  type ShootoutTeam,
} from './shootout'

const props = withDefaults(
  defineProps<{
    home: ShootoutTeam
    away: ShootoutTeam
    kicks: ShootoutGridKick[]
    firstTeamId?: number | null
    homePenalties?: number | null
    awayPenalties?: number | null
    live?: boolean
  }>(),
  { firstTeamId: null, homePenalties: null, awayPenalties: null, live: false },
)

const legacy = computed(
  () => props.kicks.length === 0 && props.homePenalties != null && props.awayPenalties != null,
)
const columns = computed(() => shootoutColumns(props.kicks, props.home.id, props.away.id))
const extraColumns = computed(() => columns.value - REGULATION_KICKS)
const firstTeam = computed(() => props.kicks[0]?.team_id ?? props.firstTeamId)

const result = computed(() => draftResult(props.kicks, props.home.id, props.away.id))

const scroller = ref<HTMLElement | null>(null)
const table = ref<HTMLElement | null>(null)
const hiddenLeft = ref(false)
const hiddenRight = ref(false)
let observer: ResizeObserver | null = null

function updateHidden() {
  const el = scroller.value
  if (!el) return
  hiddenLeft.value = el.scrollLeft > 1
  hiddenRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

onMounted(() => {
  updateHidden()
  observer = new ResizeObserver(updateHidden)
  if (scroller.value) observer.observe(scroller.value)
  if (table.value) observer.observe(table.value)
})
onBeforeUnmount(() => observer?.disconnect())

function resultLabel(state: TeamResult): string {
  if (state === 'scored') return 'convertido'
  if (state === 'missed') return 'perdido'
  return 'sem resultado'
}

type TeamResult = 'scored' | 'missed' | 'pending' | 'empty'

const rows = computed(() =>
  (
    [
      { side: 'home', badge: 'M', team: props.home },
      { side: 'away', badge: 'V', team: props.away },
    ] as { side: TeamSide; badge: string; team: ShootoutTeam }[]
  ).map(({ side, badge, team }) => {
    const teamKicks = props.kicks.filter((kick) => kick.team_id === team.id)
    return {
      side,
      badge,
      name: team.name,
      first: firstTeam.value === team.id,
      winner: result.value.winner === team.id,
      total: teamKicks.filter((kick) => kick.scored === true).length,
      cells: Array.from({ length: columns.value }, (_, index) => {
        const kick = teamKicks[index]
        const state: TeamResult = !kick
          ? 'empty'
          : kick.scored === null
            ? 'pending'
            : kick.scored
              ? 'scored'
              : 'missed'
        const who = kick ? [kick.number != null ? `nº ${kick.number}` : null, kick.name] : []
        return {
          order: index + 1,
          suddenDeath: index >= REGULATION_KICKS,
          number: kick?.number ?? null,
          name: kick?.name ?? null,
          state,
          label: kick
            ? `Cobrança ${index + 1}: ${[...who.filter(Boolean), resultLabel(state)].join(', ')}`
            : `Cobrança ${index + 1}: não cobrou`,
        }
      }),
    }
  }),
)

const winnerName = computed(() => {
  if (legacy.value) {
    if (props.homePenalties === props.awayPenalties) return null
    return (props.homePenalties ?? 0) > (props.awayPenalties ?? 0)
      ? props.home.name
      : props.away.name
  }
  if (result.value.winner === null) return null
  return result.value.winner === props.home.id ? props.home.name : props.away.name
})

const summary = computed(() => {
  if (legacy.value) {
    const score = `${props.homePenalties} × ${props.awayPenalties}`
    return winnerName.value ? `Pênaltis: ${score}, ${winnerName.value} vence` : `Pênaltis: ${score}`
  }
  if (props.kicks.length === 0) return null
  const score = `${result.value.home} × ${result.value.away}`
  if (result.value.finished) return `Disputa decidida: ${score}, ${winnerName.value} vence`
  return props.live ? `Placar parcial: ${score}` : `Placar: ${score}`
})
</script>

<template>
  <div class="shootout" data-test="shootout-grid">
    <template v-if="legacy">
      <div class="text-subtitle-1 font-weight-bold" data-test="shootout-result">{{ summary }}</div>
      <div class="text-caption text-medium-emphasis" data-test="shootout-legacy">
        Placar registrado sem as cobranças.
      </div>
    </template>
    <template v-else>
      <div
        ref="scroller"
        class="shootout-scroll"
        :class="{ 'hidden-left': hiddenLeft, 'hidden-right': hiddenRight }"
        data-test="shootout-scroll"
        @scroll.passive="updateHidden"
      >
        <table ref="table" class="shootout-table">
          <caption class="d-sr-only">
            Cobranças de pênalti
          </caption>
          <thead>
            <tr class="groups">
              <th rowspan="2" class="corner" scope="col"><span class="d-sr-only">Time</span></th>
              <th :colspan="REGULATION_KICKS" scope="colgroup">Regulamentares</th>
              <th
                v-if="extraColumns > 0"
                :colspan="extraColumns"
                class="sd"
                scope="colgroup"
                data-test="shootout-sudden-death"
              >
                Alternadas
              </th>
              <th rowspan="2" class="total-head" scope="col">Total</th>
            </tr>
            <tr class="nums">
              <th
                v-for="column in columns"
                :key="column"
                :class="{
                  sd: column > REGULATION_KICKS,
                  'sd-start': column === REGULATION_KICKS + 1,
                }"
                scope="col"
              >
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.side" :data-test="`shootout-row-${row.side}`">
              <th scope="row" class="team">
                <div class="team-name">
                  <span class="side" aria-hidden="true">{{ row.badge }}</span>
                  <span class="text-truncate" :title="row.name">{{ row.name }}</span>
                </div>
                <div v-if="row.first" class="first text-caption" data-test="shootout-first">
                  Bateu primeiro
                </div>
              </th>
              <td
                v-for="cell in row.cells"
                :key="cell.order"
                class="kick"
                :class="{ sd: cell.suddenDeath, 'sd-start': cell.order === REGULATION_KICKS + 1 }"
                :title="cell.name ?? undefined"
                :aria-label="cell.label"
                :data-result="cell.state"
                data-test="shootout-kick"
              >
                <div class="num">{{ cell.number ?? '' }}</div>
                <svg class="mark" viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="7.6" class="ring" />
                  <circle v-if="cell.state === 'scored'" cx="10" cy="10" r="6.2" class="fill" />
                  <path
                    v-else-if="cell.state === 'missed'"
                    d="M4.6 4.6 15.4 15.4M15.4 4.6 4.6 15.4"
                    class="cross"
                  />
                </svg>
              </td>
              <td class="total" :class="{ winner: row.winner }" data-test="shootout-total">
                {{ row.total }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="summary"
        class="text-subtitle-1 font-weight-bold mt-3"
        :class="{ 'text-primary': result.finished }"
        data-test="shootout-result"
      >
        {{ summary }}
      </div>
      <div class="legend text-caption text-medium-emphasis mt-1">
        <span class="legend-item">
          <svg class="mark" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.6" class="ring" />
            <circle cx="10" cy="10" r="6.2" class="fill" />
          </svg>
          Convertido
        </span>
        <span class="legend-item">
          <svg class="mark" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.6" class="ring" />
            <path d="M4.6 4.6 15.4 15.4M15.4 4.6 4.6 15.4" class="cross" />
          </svg>
          Perdido
        </span>
        <span>Número: camisa do cobrador</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shootout-scroll {
  overflow-x: auto;
}
.shootout-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.shootout-table th,
.shootout-table td {
  border-right: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.shootout-table tr > :first-child {
  border-left: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.shootout-table thead tr.groups th {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.shootout-table thead th {
  padding: 4px;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}
.groups th {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.groups th.corner {
  position: sticky;
  left: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  border-color: transparent;
  border-right-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.nums th {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-size: 0.875rem;
}
.nums th.sd,
.kick.sd {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.sd-start {
  border-left: 2px solid rgb(var(--v-theme-primary));
}
.team {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 72px;
  max-width: 92px;
  padding: 6px;
  text-align: left;
  font-weight: 700;
  background: rgb(var(--v-theme-surface));
}
.team-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.side {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.75rem;
}
.first {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.kick {
  min-width: 28px;
  padding: 4px 1px 6px;
  text-align: center;
  vertical-align: top;
}
.num {
  height: 18px;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 18px;
}
.mark {
  display: block;
  width: 24px;
  height: 24px;
  margin: 2px auto 0;
  overflow: visible;
}
.mark .ring {
  fill: none;
  stroke: rgba(var(--v-theme-on-surface), 0.55);
  stroke-width: 1.2;
}
.mark .fill {
  fill: rgb(var(--v-theme-success));
}
.mark .cross {
  fill: none;
  stroke: rgb(var(--v-theme-error));
  stroke-width: 2.2;
  stroke-linecap: round;
}
.total,
.total-head {
  position: sticky;
  right: 0;
  z-index: 1;
}
.total {
  min-width: 36px;
  padding: 4px;
  text-align: center;
  vertical-align: middle;
  font-size: 1.375rem;
  font-weight: 700;
  background:
    linear-gradient(rgba(var(--v-theme-primary), 0.06), rgba(var(--v-theme-primary), 0.06)),
    rgb(var(--v-theme-surface));
}
.total.winner {
  color: rgb(var(--v-theme-primary));
  background:
    linear-gradient(rgba(var(--v-theme-primary), 0.16), rgba(var(--v-theme-primary), 0.16)),
    rgb(var(--v-theme-surface));
}
.total-head {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.hidden-left .team,
.hidden-left .corner {
  box-shadow: 6px 0 6px -4px rgba(0, 0, 0, 0.35);
}
.hidden-right .total,
.hidden-right .total-head {
  box-shadow: -6px 0 6px -4px rgba(0, 0, 0, 0.35);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 16px;
  row-gap: 4px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend .mark {
  width: 14px;
  height: 14px;
  margin: 0;
}
@media (min-width: 600px) {
  .team {
    min-width: 96px;
    max-width: 240px;
    padding: 8px 12px;
  }
  .kick {
    min-width: 36px;
    padding: 4px 2px 6px;
  }
  .groups th {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .total {
    min-width: 44px;
  }
  .mark {
    width: 30px;
    height: 30px;
  }
}
</style>
