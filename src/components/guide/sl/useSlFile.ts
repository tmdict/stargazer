import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlData, SlSample } from '@/lib/pvp/sl/data/types'
import { isRetiredSeason } from '@/lib/seasonal'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { reloadOntoCurrentBuild } from '@/router/routes'

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
 * console can reach. */
export function useSlFile() {
  const route = useRoute()
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
  })

  return { file: (): SlData | null => data, heading, failed, mounted }
}
