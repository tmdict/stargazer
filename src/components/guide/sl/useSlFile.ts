import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useSlEngine } from '@/composables/useSlEngine'
import { loadSlData } from '@/lib/pvp/data/codec'
import { withheldHeroes } from '@/lib/pvp/data/sides'
import type { SlData, SlSeason } from '@/lib/pvp/data/types'
import { slBoards } from '@/lib/pvp/generator/setType'
import { isRetiredSeason } from '@/lib/seasonal'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import type { LockedHeroes } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { reloadOntoCurrentBuild } from '@/utils/chunkRecovery'

interface SlHeading {
  season: number
  date: string
  // A Supreme League map has no recorded teams yet.
  newMaps: boolean
  retired: boolean
  seasons: SlSeason[]
}

/* The PvP data file and the Supreme League worker for a page that draws from
 * both. The file is read after mount, as the pages are pre-rendered with their
 * heading alone, and stays plain, never reactive, so the decoded data stays
 * out of anything the console can reach. `locked` holds the heroes kept off
 * teams (withheldHeroes), which the pages' pickers lock. */
export function useSlFile() {
  const route = useRoute()
  const gameData = useGameDataStore()
  gameData.initializeData()
  const i18n = useI18nStore()
  const engine = useSlEngine()
  let data: SlData | null = null
  const heading = ref<SlHeading | null>(null)
  const failed = ref(false)
  const mounted = ref(false)

  // A load can fail after the page is left, when the route is another page's.
  let active = true
  onUnmounted(() => {
    active = false
  })

  onMounted(async () => {
    mounted.value = true
    try {
      data = await loadSlData()
    } catch {
      // A tab left open across a deploy asks for a file the deploy replaced, so
      // it reloads once. A browser that cannot decode the file never would.
      if (!active) return
      if (
        typeof DecompressionStream === 'undefined' ||
        !globalThis.crypto?.subtle ||
        !reloadOntoCurrentBuild(route.fullPath)
      ) {
        failed.value = true
      }
      return
    }
    heading.value = {
      season: data.season,
      date: data.exportedAt,
      newMaps: slBoards(data, TEAM_VARIANTS.sl.maps).some((board) => board.source === null),
      retired: isRetiredSeason(data.season),
      seasons: data.seasons,
    }
  })

  const locked = computed<LockedHeroes>(() => ({
    ids: withheldHeroes(gameData.characters),
    note: i18n.t('app.sl-withheld'),
  }))

  const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))
  const ready = computed(() => !!heading.value && engine.status.value === 'ready')
  const waiting = computed(() => !failed.value && engine.status.value === 'loading')
  const loadFailed = computed(() => failed.value || engine.status.value === 'failed')

  // One of the page's requests to the worker, which `busy` holds for. A file
  // whose parts do not line up passes the shape check and fails in the worker
  // or in the page's own work on the answer, and `reset` then clears what the
  // page shows.
  const busy = ref(false)
  const run = async (work: () => Promise<void>, reset: () => void): Promise<void> => {
    busy.value = true
    try {
      await work()
      failed.value = false
    } catch {
      reset()
      failed.value = true
    } finally {
      busy.value = false
    }
  }

  return {
    file: (): SlData | null => data,
    engine,
    heading,
    locked,
    mounted,
    heroes,
    ready,
    waiting,
    loadFailed,
    busy,
    run,
  }
}
