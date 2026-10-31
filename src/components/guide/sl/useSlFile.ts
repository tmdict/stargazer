import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { loadSlData } from '@/lib/pvp/sl/data/codec'
import { decidedGames, unratedHeroes } from '@/lib/pvp/sl/data/games'
import type { SlData, SlSample } from '@/lib/pvp/sl/data/types'
import { isRetiredSeason } from '@/lib/seasonal'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import type { LockedHeroes } from '@/lib/types/character'
import { reloadOntoCurrentBuild } from '@/router/routes'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

interface SlHeading {
  season: number
  date: string
  // The file's maps are not the current rotation's.
  rotation: boolean
  retired: boolean
  sample: SlSample
  before: (SlSample & { season: number }) | null
}

/* The Supreme League data file for a page that draws from it, read after
 * mount, as the pages are pre-rendered with their heading alone. The file
 * stays plain, never reactive, so the decoded data stays out of anything the
 * console can reach. `locked` holds the heroes the file cannot rate yet, which
 * the pages' pickers keep off teams; it is empty until the file loads. */
export function useSlFile() {
  const route = useRoute()
  const gameData = useGameDataStore()
  const i18n = useI18nStore()
  let data: SlData | null = null
  const heading = ref<SlHeading | null>(null)
  const unrated = ref<ReadonlySet<number>>(new Set())
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
      if (typeof DecompressionStream === 'undefined' || !reloadOntoCurrentBuild(route.fullPath)) {
        failed.value = true
      }
      return
    }
    heading.value = {
      season: data.season,
      date: data.exportedAt,
      rotation: data.maps.map((m) => m.key).join() !== TEAM_VARIANTS.sl.maps.join(),
      retired: isRetiredSeason(data.season),
      sample: data.sample,
      before: data.before ? { season: data.before.season, ...data.before.sample } : null,
    }
    unrated.value = unratedHeroes(
      decidedGames(data),
      data.season,
      gameData.characters.filter((c) => !c.placeholder),
    )
  })

  const locked = computed<LockedHeroes>(() => ({
    ids: unrated.value,
    note: i18n.t('app.sl-unrated'),
  }))

  return { file: (): SlData | null => data, heading, locked, failed, mounted }
}
