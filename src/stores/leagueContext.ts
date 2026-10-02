import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { leaguesService } from '@/services/api/leagues.service'
import type { Championship, League } from '@/types/championship'
import type { CardsSplit, LeagueDashboard } from '@/types/dashboard'

const STORAGE_KEY = 'footfy_active_league'

export interface DashboardSnapshot {
  dashboard: LeagueDashboard
  cards: CardsSplit | null
}

export interface ChampionshipWithLeagues {
  championship: Championship
  leagues: League[]
}

function readStoredLeagueId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  const id = raw ? Number(raw) : NaN
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Contexto de Liga ativa do painel admin. GET /leagues já vem escopado no backend
 * (master recebe todas as ligas; demais papéis só as ligas vinculadas), então a lista
 * carregada aqui é a fonte de verdade do que o usuário pode acessar — o guard de rota
 * usa `hasAccess` para bloquear URLs de ligas fora desse escopo.
 */
export const useLeagueContextStore = defineStore('leagueContext', () => {
  const leagues = ref<League[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const activeLeagueId = ref<number | null>(readStoredLeagueId())

  let pending: Promise<void> | null = null
  // Último Dashboard carregado por liga: ao voltar para uma liga já vista, a tela pinta
  // na hora e revalida em segundo plano, em vez de piscar vazia a cada troca de contexto.
  const dashboardCache = new Map<number, DashboardSnapshot>()

  const activeLeague = computed(
    () => leagues.value.find((league) => league.id === activeLeagueId.value) ?? null,
  )

  // Campeonatos derivados das ligas acessíveis, para a tela de seleção.
  const championships = computed<ChampionshipWithLeagues[]>(() => {
    const groups = new Map<number, ChampionshipWithLeagues>()
    for (const league of leagues.value) {
      if (!league.championship) continue
      const group = groups.get(league.championship.id)
      if (group) {
        group.leagues.push(league)
      } else {
        groups.set(league.championship.id, { championship: league.championship, leagues: [league] })
      }
    }
    return [...groups.values()].sort((a, b) =>
      a.championship.name.localeCompare(b.championship.name, 'pt-BR'),
    )
  })

  function leaguesOf(championshipId: number): League[] {
    return championships.value.find((g) => g.championship.id === championshipId)?.leagues ?? []
  }

  function hasAccess(leagueId: number): boolean {
    return leagues.value.some((league) => league.id === leagueId)
  }

  async function loadLeagues(force = false): Promise<void> {
    if (loaded.value && !force) return
    if (pending) return pending

    loading.value = true
    errorMessage.value = null
    pending = leaguesService
      .list()
      .then((data) => {
        leagues.value = data
        loaded.value = true
      })
      .catch((err) => {
        errorMessage.value = 'Não foi possível carregar as ligas disponíveis.'
        throw err
      })
      .finally(() => {
        loading.value = false
        pending = null
      })
    return pending
  }

  function setActiveLeague(leagueId: number) {
    activeLeagueId.value = leagueId
    localStorage.setItem(STORAGE_KEY, String(leagueId))
  }

  function reset() {
    leagues.value = []
    loaded.value = false
    errorMessage.value = null
    activeLeagueId.value = null
    dashboardCache.clear()
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    leagues,
    loaded,
    loading,
    errorMessage,
    activeLeagueId,
    activeLeague,
    championships,
    dashboardCache,
    leaguesOf,
    hasAccess,
    loadLeagues,
    setActiveLeague,
    reset,
  }
})
