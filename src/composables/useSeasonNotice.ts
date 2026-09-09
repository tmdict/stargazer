/* Page-level notice that retired seasonal content was stripped: any strip
 * site — quiet slot restores, link ingress, explicit team loads, the arena
 * rotation pass — raises it, and the SeasonNotice banner renders it wherever
 * a page mounts one. State is a module-level singleton (the useSelectionState
 * idiom) so a strip raised during startup reaches whichever page mounts
 * first. Session-only by design: every strip persists (the autosave rewrites
 * the slot, the rotation pass writes its marker), so the event cannot repeat
 * on the next visit and dismissal needs no storage. */

import { ref, type Ref } from 'vue'

const season = ref<number | null>(null)

export function useSeasonNotice(): {
  season: Ref<number | null>
  notify: (retiredSeason: number) => void
  dismiss: () => void
} {
  const notify = (retiredSeason: number): void => {
    season.value = retiredSeason
  }
  const dismiss = (): void => {
    season.value = null
  }
  return { season, notify, dismiss }
}
