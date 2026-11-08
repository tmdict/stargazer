<script setup lang="ts">
/* The PvP team generator: for the heroes and levels a visitor picks, the set
   of recorded teams, one per board and no hero twice, with the best chance to
   win a match (lib/pvp), chosen in the Supreme League worker (useSlEngine)
   so the page stays responsive. The boards are a Teams mode on one of its map
   lists, picked as on the Teams page, or the boards of the Arena or Teams page
   where they match no list. A set drawn on a page's boards is offered back
   with Open in Arena or Teams, and the boards of the page Generate's ↗ opened
   this one from (lib/pvp/generator/handover) are drawn on arrival. The picker
   edits the active roster, or under All heroes a draft (useSlRoster). The set
   is chosen only on Generate and stays as it is while the selection, the mode
   or the maps change. A board draws the formation of its team's recorded game
   where the team was recorded on its map, and the engine's elsewhere; the
   engine's formations of the recorded boards, which their switches show, are
   worked out in the worker once the set is drawn. Save as team opens the set
   on the Teams page as drawn.
   The page is pre-rendered with its heading alone: the picker and the set
   follow the visitor's rosters, which the browser holds, so they are drawn
   after mount. */

import { computed, nextTick, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import SlAbout from '@/components/guide/sl/SlAbout.vue'
import SlBar, { type MapsChoice } from '@/components/guide/sl/SlBar.vue'
import SlHead from '@/components/guide/sl/SlHead.vue'
import SlResult, { type SlShown, type SlShownTeam } from '@/components/guide/sl/SlResult.vue'
import RosterEditor from '@/components/RosterEditor.vue'
import { useSlFile } from '@/components/guide/sl/useSlFile'
import { useSlRoster } from '@/components/guide/sl/useSlRoster'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { readSavedBoards, readTeamsSlot } from '@/composables/useGridPersistence'
import { useSlEngine } from '@/composables/useSlEngine'
import { useToast } from '@/composables/useToast'
import type { AttrRecord } from '@/lib/characters/attributes'
import { tilesLayout, type MapLayout } from '@/lib/maps'
import type { SlData } from '@/lib/pvp/data/types'
import { shownFormation, type BoardFormation } from '@/lib/pvp/generator/formation'
import {
  generatorMode,
  generatorPagePath,
  isGeneratorFrom,
  type GeneratorFrom,
} from '@/lib/pvp/generator/handover'
import { slPicks } from '@/lib/pvp/generator/picks'
import { layoutBoards, slBoards, type SlBoard } from '@/lib/pvp/generator/setType'
import type { SwapPreview } from '@/lib/pvp/generator/swapPreview'
import { slTeamData } from '@/lib/pvp/generator/team'
import type { SlChoice, SlPick } from '@/lib/pvp/generator/types'
import {
  DEFAULT_TEAM_MODE,
  DEFAULT_VARIANT,
  matchVariant,
  MAX_SAVED_TEAMS,
  TEAM_MODE_ORDER,
  TEAM_MODES,
  variantMaps,
  type TeamModeKey,
  type VariantMatch,
} from '@/lib/teams/modes'
import { holdsUnsavedWork } from '@/lib/teams/savedTeam'
import { boardsHoldSide } from '@/lib/teams/sideLoad'
import { Team } from '@/lib/types/team'
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

const { levels, edit, dirty, saveRoster, exportShown, report } = useSlRoster(heroes, locked)

const armedConfirm = useArmedConfirm()

// The saved boards of a page whose mode is the one on screen: the Arena's one
// board in 1v1, the Teams page's boards of each mode.
interface PageBoards {
  page: GeneratorFrom
  layouts: MapLayout[]
  // The list they match; null when they match none, which makes them a choice.
  match: VariantMatch
}
const PAGES: GeneratorFrom[] = ['arena', ...TEAM_MODE_ORDER]
const readPageBoards = (mode: TeamModeKey): PageBoards[] =>
  PAGES.filter((page) => generatorMode(page) === mode).flatMap((page) => {
    const boards = readSavedBoards(page)
    if (!boards?.length) return []
    const layouts = boards.map((board) => tilesLayout(board.t ?? []))
    const match = matchVariant(
      mode,
      layouts.map((layout) => layout.key),
    )
    return [{ page, layouts, match }]
  })
// Read when the page opens and on each switch of mode, so the choices follow
// those boards as they are then. Shallow, since the layouts are posted to the
// worker, which takes no proxies.
const pageBoards = shallowRef<PageBoards[]>([])
const offeredPages = computed(() =>
  pageBoards.value.flatMap((own) => (own.match === null ? [own.page] : [])),
)
// The page Generate's ↗ came from.
let arrived: GeneratorFrom | null = null

const mode = ref<TeamModeKey>(DEFAULT_TEAM_MODE)
const maps = ref<MapsChoice>(TEAM_MODES[DEFAULT_TEAM_MODE].initialVariant ?? DEFAULT_VARIANT)
const variant = computed((): VariantMatch => (isGeneratorFrom(maps.value) ? null : maps.value))

// A mode opens on its usual list, or on the boards of the page Generate's ↗
// came from when they are of that mode.
const openMode = (next: TeamModeKey): void => {
  pageBoards.value = readPageBoards(next)
  const own = pageBoards.value.find((boards) => boards.page === arrived)
  maps.value = own ? (own.match ?? own.page) : (TEAM_MODES[next].initialVariant ?? DEFAULT_VARIANT)
}
watch(mode, openMode)

const boardsFor = (file: SlData): SlBoard[] => {
  const own = pageBoards.value.find((boards) => boards.page === maps.value)
  return own
    ? layoutBoards(file, own.layouts)
    : slBoards(file, variantMaps(mode.value, variant.value ?? DEFAULT_VARIANT))
}

// The page a set can go back to: one whose boards it is drawn on, the chosen
// page or the one Generate's ↗ came from first, as the Arena and the Teams
// page's 1v1 can share a map.
const backTo = (boards: readonly SlBoard[]): GeneratorFrom | null => {
  const keys = (layouts: readonly MapLayout[]): string => layouts.map((l) => l.key).join(' ')
  const drawnOn = keys(boards.map((board) => board.layout))
  const fits = pageBoards.value.flatMap((own) => (keys(own.layouts) === drawnOn ? [own.page] : []))
  return (
    fits.find((page) => page === maps.value) ??
    fits.find((page) => page === arrived) ??
    fits[0] ??
    null
  )
}

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
  slPicks(levels, (id) => gameData.getCharacterById(id)?.faction, locked.value.ids)

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
    const picks = picksOf(levels.value)
    const chosenFor = { mode: mode.value, variant: variant.value }
    const boards = boardsFor(file)
    const from = backTo(boards)
    const set = await generateSet(picks, boards)
    const draws = set ? await placeSet(set, boards) : []
    // Each swap is tried once per set and formation, when first shown.
    const tried = new Map<string, Promise<SwapPreview | null>>()
    const teams = (set?.teams ?? []).map((t, index): SlShownTeam => {
      const board = boards[index]!
      const family = t.family === null ? null : file.families[t.family]!
      return {
        map: board.map,
        group: family && { name: family.name, core: family.core },
        comp: t.comp,
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
            const swap = { board, team: t, units, out: [...out], into: [...into] }
            found = previewSwap(swap).catch(() => null)
            tried.set(key, found)
          }
          return found
        },
      }
    })
    engineOn.value = []
    shown.value = set && {
      ...chosenFor,
      from,
      chance: set.chance,
      odds: set.odds,
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
  () => !!shown.value && armedConfirm.armed.value === saveKey(shown.value.mode),
)

// The saved team holds the levels the set was chosen with, not the levels
// shown since. A team kept only in memory still opens on the Teams page. A
// second press while that page loads saves nothing more.
let saving = false
const save = (): void => {
  if (!shown.value || saving) return
  const { mode } = shown.value
  const replacing = replacesWork(mode)
  if (replacing && !armedConfirm.confirm(saveKey(mode))) {
    show(i18n.t('app.sl-save-replaces', { mode }), 'info')
    return
  }
  const now = new Date()
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-')
  const name =
    shown.value.variant === 'sl'
      ? i18n.t('app.sl-team-name', { date })
      : i18n.t('app.sl-team-name-mode', { mode, date })
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

// Open in Arena replaces your side of the Arena's board, and Open in Teams
// replaces that mode's boards with a new team, so a press that would lose
// something there takes a second one.
const openKey = (from: GeneratorFrom): string => `open:${from}`
const openArmed = computed(
  () => !!shown.value?.from && armedConfirm.armed.value === openKey(shown.value.from),
)
const openReplaces = (from: GeneratorFrom): boolean => {
  if (from !== 'arena') return replacesWork(from)
  const saved = readSavedBoards(from)
  return !!saved && boardsHoldSide(saved, Team.ALLY)
}
const open = (): void => {
  const from = shown.value?.from
  if (!from || !drawn.value) return
  if (openReplaces(from) && !armedConfirm.confirm(openKey(from))) {
    if (from !== 'arena') show(i18n.t('app.sl-open-replaces', { mode: from }), 'info')
    return
  }
  void router.push({ path: generatorPagePath(from), state: { generatedSide: drawn.value } })
}

// Opened through Generate's ↗: the page opens on that page's mode and boards
// and draws their set as soon as it can. The note stays in the history entry,
// so a reload reads the boards again.
const drawOnArrival = ref(false)
onMounted(() => {
  const from: unknown = history.state?.generatorFrom
  if (isGeneratorFrom(from) && readSavedBoards(from)?.length) {
    arrived = from
    mode.value = generatorMode(from)
    drawOnArrival.value = true
  }
  openMode(mode.value)
})
const ready = computed(() => !!heading.value && engineStatus.value === 'ready')
watch([ready, drawOnArrival], ([isReady, waiting]) => {
  if (!isReady || !waiting) return
  drawOnArrival.value = false
  void generate()
})
</script>

<template>
  <main class="sl-page" data-theme="dark">
    <SlHead :title="i18n.t('app.sl-title')" :records="heading" @about="aboutOpen = true" />
    <SlAbout
      v-if="heading"
      :show="aboutOpen"
      page="sl"
      :date="heading.date"
      :seasons="heading.seasons"
      @close="aboutOpen = false"
    />
    <p v-if="heading?.retired" class="sl-line sl-note">{{ i18n.t('app.sl-previous-season') }}</p>
    <p v-if="heading?.newMaps && variant === 'sl'" class="sl-line sl-note">
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
        :open-armed
        @save="save"
        @open="open"
      />
      <p v-else-if="noSet" class="sl-line">
        {{ noSet === 1 ? i18n.t('app.sl-no-team') : i18n.t('app.sl-no-set', { count: noSet }) }}
      </p>
    </div>

    <section v-if="mounted" class="sl-panel sl-picker">
      <SlBar
        v-model:mode="mode"
        v-model:maps="maps"
        :pages="offeredPages"
        :busy
        :ready
        :waiting="!failed && engineStatus === 'loading'"
        :dirty
        :new-name="rosters.nextName"
        :export-file="rosters.active ? undefined : exportShown"
        @generate="generate"
        @save-roster="saveRoster"
      />
      <RosterEditor
        :heroes
        :levels
        :source-key="rosters.activeId"
        :armed-confirm
        :locked
        hide-mechanics
        large-dock
        @edit="edit"
        @settle="rosters.active && report()"
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
