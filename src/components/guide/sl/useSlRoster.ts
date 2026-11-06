import { computed, ref, watch, type Ref } from 'vue'

import { useRosterFeedback } from '@/composables/useRosterFeedback'
import { useToast } from '@/composables/useToast'
import { TOP_LEVELS, type AttrRecord } from '@/lib/characters/attributes'
import {
  buildRostersExport,
  canonicalHeroes,
  canonicalLevels,
  newRoster,
  type RostersExportFile,
} from '@/lib/rosters'
import type { LockedHeroes } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

/* The generator's heroes and levels. A selected roster is edited in place and
 * takes each change at once, as on the Rosters tab. Under All heroes the page
 * edits a draft of every hero at the top levels, which Save makes a new roster
 * of and Export writes as a roster file; picking, saving or importing a roster
 * drops it. */
export function useSlRoster(
  heroes: Readonly<Ref<readonly { id: number }[]>>,
  locked: Readonly<Ref<LockedHeroes>>,
) {
  const rosters = useRosters()
  const i18n = useI18nStore()
  const { error } = useToast()
  const { report } = useRosterFeedback()

  const allHeroes = computed((): Record<string, AttrRecord> =>
    Object.fromEntries(heroes.value.map((c) => [c.id, TOP_LEVELS])),
  )
  const draft = ref<Record<string, AttrRecord>>({})
  watch(
    () => rosters.activeId,
    () => (draft.value = { ...allHeroes.value }),
    { immediate: true },
  )
  const levels = computed(() => rosters.active?.heroes ?? draft.value)

  // Under All heroes a hero added back returns at the top levels.
  const edit = (changes: Record<string, AttrRecord | null>): void => {
    const roster = rosters.active
    if (roster) {
      rosters.setHeroes(roster.id, changes)
      return
    }
    const next = { ...draft.value }
    for (const [key, change] of Object.entries(changes)) {
      if (change === null) delete next[key]
      else next[key] = next[key] ? canonicalLevels(Number(key), change) : TOP_LEVELS
    }
    draft.value = next
  }

  const heroesKey = (pool: Record<string, AttrRecord>): string =>
    JSON.stringify(canonicalHeroes(pool))
  const dirty = computed(
    () => !rosters.active && heroesKey(draft.value) !== heroesKey(allHeroes.value),
  )

  // The heroes the picker shows as owned, which leaves out locked ones.
  const shownHeroes = (): Record<string, AttrRecord> =>
    Object.fromEntries(
      Object.entries(draft.value).filter(([id]) => !locked.value.ids.has(Number(id))),
    )

  const saveRoster = (name: string): void => {
    const created = rosters.create({ name, heroes: shownHeroes() })
    if (!created) error(i18n.t('app.rosters-limit'))
    else {
      const count = Object.keys(created.heroes).length
      report(i18n.t('app.roster-saved', { name: created.name, count }))
    }
  }

  const exportShown = (): RostersExportFile => {
    const now = Date.now()
    const roster = newRoster(rosters.nextName, shownHeroes(), now)
    return buildRostersExport([roster], new Date(now).toISOString())
  }

  return { levels, edit, dirty, saveRoster, exportShown, report }
}
