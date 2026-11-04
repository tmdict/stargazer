<script setup lang="ts">
/* The PvP team generator: for the heroes and levels a visitor picks, the set
   of recorded teams, one per board and no hero twice, with the best chance to
   win a match (lib/pvp/sl), chosen in the Supreme League worker (useSlEngine)
   so the page stays responsive. The boards are the current Supreme League
   maps, or with the 5v5 or 3v3 type all on map 1, as the Teams page's default
   boards are. The picker edits a copy of the active roster, so trying a hero
   out never changes the roster, and picking or importing another roster takes
   a fresh copy. The set is chosen only on Generate and stays as it is while the
   selection or the type changes. A board draws the formation of its team's
   recorded game where the team was recorded on its map, and the engine's
   elsewhere; the engine's formations of the recorded boards, which their
   switches show, are worked out in the worker once the set is drawn. Save as
   team opens the set on the Teams page as drawn.
   The page is pre-rendered with its heading alone: the picker and the set
   follow the visitor's rosters, which the browser holds, so they are drawn
   after mount. */

import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import SlAbout from '@/components/guide/sl/SlAbout.vue'
import SlBar from '@/components/guide/sl/SlBar.vue'
import SlHead from '@/components/guide/sl/SlHead.vue'
import SlResult, { type SlShown, type SlShownTeam } from '@/components/guide/sl/SlResult.vue'
import RosterEditor from '@/components/RosterEditor.vue'
import { useSlFile } from '@/components/guide/sl/useSlFile'
import { slPercent } from '@/components/guide/sl/useSlNames'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { readTeamsSlot } from '@/composables/useGridPersistence'
import { useSlEngine } from '@/composables/useSlEngine'
import { useToast } from '@/composables/useToast'
import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  TOP_LEVELS,
  type AttrRecord,
} from '@/lib/characters/attributes'
import { shownFormation, type BoardFormation } from '@/lib/pvp/sl/generator/formation'
import { slBoards, slSetMode, type SlBoard, type SlSetType } from '@/lib/pvp/sl/generator/setType'
import type { SwapPreview } from '@/lib/pvp/sl/generator/swapPreview'
import { choiceSeason, slTeamData } from '@/lib/pvp/sl/generator/team'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { canonicalLevels } from '@/lib/rosters'
import { MAX_SAVED_TEAMS, type TeamModeKey } from '@/lib/teams/modes'
import { holdsUnsavedWork } from '@/lib/teams/savedTeam'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { setupSlContentMeta } from '@/utils/contentMeta'

import '@/components/guide/sl/sl.css'

const i18n = useI18nStore()
setupSlContentMeta(computed(() => i18n.currentLocale))

const gameData = useGameDataStore()
gameData.initializeData()
const rosters = useRosters()
const library = useTeamLibrary()
const router = useRouter()
const { error, success, show } = useToast()
const {
  status: engineStatus,
  generate: generateSet,
  place: placeSet,
  placeEngine,
  swap: previewSwap,
} = useSlEngine()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

const { file: slFile, heading, locked, failed, mounted } = useSlFile()
const aboutOpen = ref(false)

const sourceLevels = (id: number): AttrRecord | undefined =>
  rosters.active ? rosters.active.heroes[id] : TOP_LEVELS

const copy = ref<Record<string, AttrRecord>>({})
// Taken again when another roster becomes active, never on the roster object
// itself, which every library write replaces.
watch(
  () => rosters.activeId,
  () => {
    copy.value = rosters.active
      ? { ...rosters.active.heroes }
      : Object.fromEntries(heroes.value.map((c) => [c.id, TOP_LEVELS]))
  },
  { immediate: true },
)

// A hero added here comes back at the levels its roster gives it (the top
// under All heroes), and at 0 only when the roster does not hold it.
const edit = (changes: Record<string, AttrRecord | null>): void => {
  const next = { ...copy.value }
  for (const [key, levels] of Object.entries(changes)) {
    const id = Number(key)
    if (levels === null) delete next[key]
    else if (!next[key]) next[key] = sourceLevels(id) ?? {}
    else next[key] = canonicalLevels(id, levels)
  }
  copy.value = next
}

const armedConfirm = useArmedConfirm()

const type = ref<SlSetType>('sl')

const shown = ref<SlShown | null>(null)
// The boards switched to the engine's formation, by index.
const engineOn = ref<boolean[]>([])
const drawn = computed(
  () =>
    shown.value &&
    shown.value.encode(
      shown.value.teams.map((team, index) => shownFormation(team, !!engineOn.value[index])),
    ),
)
// Counts Generate presses, so a formation worked out for an earlier set is dropped.
let generations = 0
// How many teams the last Generate could not make; 0 when it made them.
const noSet = ref(0)
const busy = ref(false)
const resultEl = useTemplateRef<HTMLElement>('result')

const picksOf = (levels: Record<string, AttrRecord>): SlPick[] =>
  Object.entries(levels).flatMap(([key, record]) => {
    const character = gameData.getCharacterById(Number(key))
    return character && !locked.value.ids.has(character.id)
      ? [
          {
            id: character.id,
            faction: character.faction,
            paragon: record[ATTR_PARAGON] ?? 0,
            refinement: record[ATTR_REFINEMENT] ?? 0,
          },
        ]
      : []
  })

// One board at a time, so each switch is ready once its own formation is and a
// new Generate waits behind one board's work at most. A worker that cannot
// answer leaves the switches on the recorded games.
const fillEngine = async (
  generation: number,
  set: SlChoice,
  boards: SlBoard[],
  which: number[],
): Promise<void> => {
  for (const index of which) {
    let found: BoardFormation
    try {
      found = await placeEngine(set.teams[index]!, boards[index]!)
    } catch {
      return
    }
    if (generation !== generations || !shown.value) return
    shown.value.teams[index]!.engine = found
  }
}

const generate = async (): Promise<void> => {
  const file = slFile()
  if (!file) return
  busy.value = true
  const generation = ++generations
  try {
    const picks = picksOf(copy.value)
    const chosenFor = type.value
    const boards = slBoards(file, chosenFor)
    const set = await generateSet(picks, boards)
    const draws = set ? await placeSet(set, boards) : []
    // Each swap is tried once per set and formation, when first shown.
    const tried = new Map<string, Promise<SwapPreview | null>>()
    const teams = (set?.teams ?? []).map((t, index): SlShownTeam => {
      const board = boards[index]!
      const family = t.family === null ? null : choiceSeason(file, t).families[t.family]!
      return {
        map: board.map,
        group: family && { name: family.name, core: family.core },
        // The comp's record is from the map its teams came from.
        comp: board.recorded ? t.comp : null,
        core: t.core,
        flex: t.flex,
        pairs: t.pairs,
        chance: t.chance,
        ...draws[index]!,
        trySwap: (out: number[], into: number[], engineOn: boolean) => {
          const key = `${index}|${engineOn}|${out.join()}|${into.join()}`
          let found = tried.get(key)
          if (!found) {
            // Copies, since the page's reactive lists cannot be posted to the worker.
            const units = shownFormation(teams[index]!, engineOn).units.map(
              ([hexId, unit]): [number, number] => [hexId, unit],
            )
            const swap = { board, team: t, units, out: [...out], into: [...into], picks }
            found = previewSwap(swap).catch(() => null)
            tried.set(key, found)
          }
          return found
        },
      }
    })
    engineOn.value = []
    shown.value = set && {
      type: chosenFor,
      chance: set.chance,
      odds: set.odds,
      beforeUnder: file.before ? (file.beforeUnder ?? null) : null,
      teams,
      encode: (formations) => slTeamData(file, set, picks, boards, formations),
    }
    noSet.value = set ? 0 : boards.length
    failed.value = false
    const which = draws.flatMap((draw, index) => (draw.engine ? [] : [index]))
    if (set && which.length) void fillEngine(generation, set, boards, which)
  } catch {
    // A file whose parts do not line up passes the shape check and fails in
    // the worker or here.
    shown.value = null
    failed.value = true
  } finally {
    busy.value = false
  }
  await nextTick()
  resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Save as team replaces the Teams page's boards of the set's mode, so boards
// there holding work no saved team keeps take a second press.
const replacesWork = (mode: TeamModeKey): boolean => {
  const slot = readTeamsSlot(mode)
  return slot !== null && holdsUnsavedWork(slot.data, library.get(slot.sourceId))
}
// Scoped to the mode, so a press armed for one mode's boards can never confirm
// another's.
const saveKey = (mode: TeamModeKey): string => `save-team:${mode}`
const saveArmed = computed(
  () => !!shown.value && armedConfirm.armed.value === saveKey(slSetMode(shown.value.type)),
)

// The saved team holds the levels the set was chosen with, not the levels
// shown since. A team kept only in memory still opens on the Teams page. A
// second press while that page loads saves nothing more.
let saving = false
const save = (): void => {
  if (!shown.value || saving) return
  const mode = slSetMode(shown.value.type)
  const replacing = replacesWork(mode)
  if (replacing && !armedConfirm.confirm(saveKey(mode))) {
    show(i18n.t('app.sl-save-replaces', { mode }), 'info')
    return
  }
  const chance = slPercent(shown.value.chance)
  const name =
    shown.value.type === 'sl'
      ? i18n.t('app.sl-team-name', { chance })
      : i18n.t('app.sl-team-name-mode', { mode, chance })
  const team = library.saveAsNew(mode, drawn.value!, name)
  if (!team) {
    // The library re-reads storage first, so another tab may have filled it.
    error(
      library.teams.length >= MAX_SAVED_TEAMS
        ? i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS })
        : i18n.t('app.team-unreadable'),
    )
    return
  }
  const message = replacing ? 'app.sl-saved-replaced' : 'app.team-saved'
  if (!library.persisted) error(i18n.t('app.team-not-stored'))
  else success(i18n.t(message, { name: team.name, mode }))
  saving = true
  void router.push({ path: '/teams', state: { openTeam: team.id } }).finally(() => {
    saving = false
  })
}
</script>

<template>
  <main class="sl-page" data-theme="dark">
    <SlHead :title="i18n.t('app.sl-title')" :records="heading" @about="aboutOpen = true" />
    <SlAbout
      v-if="heading"
      :show="aboutOpen"
      page="sl"
      :season="heading.season"
      :date="heading.date"
      :sample="heading.sample"
      :before="heading.before"
      @close="aboutOpen = false"
    />
    <p v-if="heading?.retired" class="sl-line sl-note">{{ i18n.t('app.sl-previous-season') }}</p>
    <p v-if="heading?.newMaps && type === 'sl'" class="sl-line sl-note">
      {{ i18n.t('app.sl-new-maps') }}
    </p>
    <p v-if="failed || engineStatus === 'failed'" class="sl-line sl-note">
      {{ i18n.t('app.sl-load-failed') }}
    </p>

    <div v-if="mounted" ref="result" class="sl-result-slot">
      <SlResult
        v-if="shown && drawn"
        v-model:engine-on="engineOn"
        :shown
        :data="drawn"
        :save-armed
        @save="save"
      />
      <p v-else-if="noSet" class="sl-line">{{ i18n.t('app.sl-no-set', { count: noSet }) }}</p>
    </div>

    <section v-if="mounted" class="sl-panel sl-picker">
      <SlBar
        v-model:type="type"
        :busy
        :ready="!!heading && engineStatus === 'ready'"
        :waiting="!failed && engineStatus === 'loading'"
        @generate="generate"
      />
      <RosterEditor
        :heroes
        :levels="copy"
        :source-key="rosters.activeId"
        :armed-confirm
        :locked
        hide-mechanics
        large-dock
        @edit="edit"
      />
    </section>
  </main>
</template>

<style scoped>
.sl-result-slot {
  margin: 4px 0;
  line-height: 1.7;
  scroll-margin-top: var(--spacing-lg);
}

.sl-result-slot:empty {
  display: none;
}

.sl-picker {
  --dock-scale: 1.4;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px 16px;
}

@media (max-width: 768px) {
  .sl-panel.sl-picker {
    padding: 12px;
    border-color: transparent;
  }
}

@media (max-width: 480px) {
  .sl-picker {
    --dock-scale: 1;
  }
}
</style>
