<script setup lang="ts">
/* Edits one hero pool: the dock, the filters and the hero grid of the Rosters
   tab. A portrait tap adds or removes the hero (removal drops its levels, as
   on a board) and its pill steps one level. The dock's add, remove and upgrade
   actions act on every hero the filters show. Select swaps the dock for a
   selection bar: portrait taps then tick heroes, and a level chip sets that
   level on every ticked hero. A mouse drag across heroes gives each the
   first hero's change, as dragging paints tiles on the map.

   The pool is the host's: `levels` holds each owned hero's levels, and every
   change comes back as `edit` (hero id to new levels, or null to remove),
   the shape the roster store's setHeroes takes. `settle` follows once a tap,
   a button or a drag stroke has made its changes, so the host reports a
   failed write once per action. Clear arms the host's two-step confirm, which
   it may share with a button of its own: only one of them is armed at a
   time. A locked hero counts as not owned whatever `levels` holds, and no
   tap, drag or dock action adds it. */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import UpgradeBulkActions from '@/components/ui/UpgradeBulkActions.vue'
import UpgradeDock from '@/components/ui/UpgradeDock.vue'
import UpgradeDockChip from '@/components/ui/UpgradeDockChip.vue'
import UpgradeDockDivider from '@/components/ui/UpgradeDockDivider.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import UpgradeLayerChips from '@/components/ui/UpgradeLayerChips.vue'
import UpgradeLevelChips from '@/components/ui/UpgradeLevelChips.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import type { useArmedConfirm } from '@/composables/useArmedConfirm'
import type { AttrLayerChoice } from '@/composables/useAttrLayerSelection'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  attrDefault,
  attrMax,
  UPGRADE_ATTRS,
  type AttrRecord,
} from '@/lib/characters/attributes'
import type { CharacterType, LockedHeroes } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  heroes: readonly CharacterType[]
  levels: Readonly<Record<string, AttrRecord>>
  // A change of pool (another roster) stops Select and clears its ticks.
  sourceKey: string | null
  armedConfirm: ReturnType<typeof useArmedConfirm>
  hideMechanics?: boolean
  // For a host whose dock is the larger one (--dock-scale 1.4): its rows
  // stack at the widths that size needs.
  largeDock?: boolean
  locked?: LockedHeroes
}>()

const emit = defineEmits<{
  edit: [changes: Record<string, AttrRecord | null>]
  settle: []
}>()

const i18n = useI18nStore()

const {
  factionFilter,
  classFilter,
  mechanicFilter,
  mechanicPool,
  filteredCharacters,
  energyPicked,
  inspectChips,
} = useCharacterFilters(computed(() => props.heroes))

const isLocked = (character: CharacterType): boolean => !!props.locked?.ids.has(character.id)
const levelsOf = (character: CharacterType): AttrRecord | undefined =>
  isLocked(character) ? undefined : props.levels[character.id]

const editHeroes = (changes: Record<string, AttrRecord | null>): void => {
  emit('edit', changes)
  emit('settle')
}

const toggle = (character: CharacterType): void =>
  editHeroes({ [character.id]: levelsOf(character) ? null : {} })

const setLevel = (character: CharacterType, attrId: number, level: number): void =>
  editHeroes({ [character.id]: { ...levelsOf(character), [attrId]: level } })

// ---- Dock ----

const shownLevels = computed(() =>
  filteredCharacters.value.flatMap((c) => {
    const levels = levelsOf(c)
    return levels ? [{ id: c.id, levels }] : []
  }),
)
const shownUnowned = computed(() =>
  filteredCharacters.value.filter((c) => !levelsOf(c) && !isLocked(c)),
)

const addShown = (): void =>
  editHeroes(Object.fromEntries(shownUnowned.value.map((c) => [c.id, {}])))

// A changed filter, pool or hero set would point an armed Clear at other
// heroes than the ones shown when it was armed.
const { armed, confirm, disarm } = props.armedConfirm
watch([filteredCharacters, () => props.sourceKey, () => props.levels], disarm)
const removeShown = (): void => {
  if (confirm('remove-shown'))
    editHeroes(Object.fromEntries(shownLevels.value.map(({ id }) => [id, null])))
}

const layer = ref<AttrLayerChoice>(ATTR_PARAGON)
const editLayers = computed(() => (layer.value === 'all' ? UPGRADE_ATTRS : [layer.value]))

const levelOf = (levels: AttrRecord, attrId: number): number =>
  levels[attrId] ?? attrDefault(attrId)

const canRaise = computed(() =>
  shownLevels.value.some(({ levels }) =>
    editLayers.value.some((attrId) => levelOf(levels, attrId) < attrMax(attrId)),
  ),
)

const canReset = computed(() =>
  shownLevels.value.some(({ levels }) =>
    editLayers.value.some((attrId) => levelOf(levels, attrId) > 0),
  ),
)

// Levels clamp on write, so a raise past max stays at max.
const editLevels = (
  targets: readonly { id: number; levels: AttrRecord }[],
  attrIds: readonly number[],
  next: (level: number, attrId: number) => number,
): void =>
  editHeroes(
    Object.fromEntries(
      targets.map(({ id, levels }) => [
        id,
        {
          ...levels,
          ...Object.fromEntries(
            attrIds.map((attrId) => [attrId, next(levelOf(levels, attrId), attrId)]),
          ),
        },
      ]),
    ),
  )

const editShown = (next: (level: number, attrId: number) => number): void =>
  editLevels(shownLevels.value, editLayers.value, next)

// ---- Selection ----

const selecting = ref(false)
const ticked = ref<ReadonlySet<number>>(new Set())
let anchorId: number | null = null

// Only owned heroes tick, and a filter change clears the ticks, so this is
// the ticked set in display order.
const tickedLevels = computed(() => shownLevels.value.filter(({ id }) => ticked.value.has(id)))

const setTicks = (ids: Iterable<number>): void => {
  ticked.value = new Set(ids)
  anchorId = null
}

// Ticks hidden by a filter would come back ticked when the filter is cleared.
watch(filteredCharacters, () => setTicks([]))

const startSelecting = (): void => {
  disarm()
  selecting.value = true
}

const stopSelecting = (): void => {
  selecting.value = false
  setTicks([])
}

watch(() => props.sourceKey, stopSelecting)

// Shift extends from the last tapped hero to this one, giving the range the
// tapped hero's new state, as list selections do.
const tick = (id: number, extend: boolean): void => {
  const order = shownLevels.value.map((hero) => hero.id)
  const from = anchorId === null ? -1 : order.indexOf(anchorId)
  const to = order.indexOf(id)
  const range = extend && from >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [id]
  const next = new Set(ticked.value)
  const on = !next.has(id)
  for (const each of range) {
    if (on) next.add(each)
    else next.delete(each)
  }
  ticked.value = next
  anchorId = id
}

// A level chip is lit when every ticked hero already has that level.
const sharedLevel = (attrId: number): number | null => {
  const [first, ...rest] = tickedLevels.value
  if (!first) return null
  const level = levelOf(first.levels, attrId)
  return rest.every(({ levels }) => levelOf(levels, attrId) === level) ? level : null
}

const setTicked = (attrId: number, level: number): void => {
  editLevels(tickedLevels.value, [attrId], () => level)
}

// Esc leaves selecting unless a modal is open: the modal takes the key, and
// one closed by it stays in the document until the next render.
const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || !selecting.value) return
  if (document.querySelector('[aria-modal="true"]')) return
  stopSelecting()
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

// ---- Drag across heroes ----

// The latest press on a hero. It paints only once it reaches a second hero,
// so a press that stays on one is still a click or a hold, and the click its
// release produces is ignored once it has painted.
interface Stroke {
  on: boolean
  from: CharacterType
  crossed: Set<number>
  held: boolean
  edited: boolean
}
let stroke: Stroke | null = null

const onPress = (character: CharacterType, event: MouseEvent): void => {
  stroke = null
  if (event.button !== 0 || isLocked(character)) return
  const owned = !!levelsOf(character)
  // Outside select mode a pill press steps a level.
  if (selecting.value ? !owned : (event.target as Element).closest('.pill-slot')) return
  const on = selecting.value ? !ticked.value.has(character.id) : !owned
  stroke = { on, from: character, crossed: new Set(), held: true, edited: false }
}

const paint = (current: Stroke, heroes: readonly CharacterType[]): void => {
  for (const { id } of heroes) current.crossed.add(id)
  if (selecting.value) {
    const next = new Set(ticked.value)
    for (const { id } of heroes.filter((c) => levelsOf(c))) {
      if (current.on) next.add(id)
      else next.delete(id)
    }
    ticked.value = next
    return
  }
  const changing = heroes.filter((c) => !isLocked(c) && !!levelsOf(c) !== current.on)
  if (!changing.length) return
  emit('edit', Object.fromEntries(changing.map(({ id }) => [id, current.on ? {} : null])))
  current.edited = true
}

// A failing write shows one message however many heroes the stroke changed.
const endStroke = (current: Stroke): void => {
  current.held = false
  if (current.edited) emit('settle')
}

// A release the page never saw (a native menu or drag took the mouse) leaves
// the stroke held, so the buttons still down decide whether it goes on. No
// click follows such a release, so the stroke ends outright.
const onCross = (character: CharacterType, event: MouseEvent): void => {
  if (!stroke?.held) return
  if (!(event.buttons & 1)) {
    endStroke(stroke)
    stroke = null
    return
  }
  if (!stroke.crossed.size) {
    if (character.id === stroke.from.id) return
    paint(stroke, [stroke.from, character])
  } else if (!stroke.crossed.has(character.id)) paint(stroke, [character])
  // Shift-click goes on from where the stroke ended, on a hero it crossed
  // before too.
  if (selecting.value && levelsOf(character)) anchorId = character.id
}

// Kept only until the click this release makes has been seen, so a later
// tick from the keyboard still counts.
const onRelease = (): void => {
  const ended = stroke
  if (!ended?.held) return
  endStroke(ended)
  setTimeout(() => {
    if (stroke === ended) stroke = null
  })
}
onMounted(() => document.addEventListener('mouseup', onRelease))
onUnmounted(() => document.removeEventListener('mouseup', onRelease))

// Esc mid-stroke would otherwise carry a tick stroke on as adds or removes.
watch(selecting, () => (stroke = null))

const onPortrait = (character: CharacterType, event: MouseEvent): void => {
  if (stroke?.crossed.size) return
  if (!selecting.value) toggle(character)
  else if (levelsOf(character)) tick(character.id, event.shiftKey)
}

// While selecting, a pill click ticks the hero instead of stepping a level.
// The styles keep the mouse off the pill's buttons; stopping the click here
// keeps the keyboard off them too.
const onPillClick = (character: CharacterType, event: MouseEvent): void => {
  if (!selecting.value) return
  event.stopPropagation()
  onPortrait(character, event)
}
</script>

<template>
  <div class="roster-editor" :class="{ selecting, 'large-dock': largeDock }">
    <UpgradeDock v-if="selecting" class="roster-dock">
      <div class="dock-rows select-rows">
        <span class="dock-group">
          <UpgradeDockLabel class="tick-count">
            {{ i18n.t('app.selected', { count: tickedLevels.length }) }}
          </UpgradeDockLabel>
          <span class="dock-controls tick-controls">
            <UpgradeDockChip
              text
              :disabled="tickedLevels.length === shownLevels.length"
              :tip="i18n.t('app.tooltip-select-all-shown')"
              @click="setTicks(shownLevels.map((hero) => hero.id))"
            >
              {{ i18n.t('app.all') }}
            </UpgradeDockChip>
            <UpgradeDockChip
              text
              :disabled="tickedLevels.length === 0"
              :tip="i18n.t('app.tooltip-select-none')"
              @click="setTicks([])"
            >
              {{ i18n.t('app.none') }}
            </UpgradeDockChip>
          </span>
        </span>
        <UpgradeDockDivider />
        <span class="dock-group">
          <UpgradeDockLabel class="level-label">{{ i18n.t('app.paragon') }}</UpgradeDockLabel>
          <span class="dock-controls">
            <UpgradeLevelChips
              :attr-id="ATTR_PARAGON"
              :lit="sharedLevel(ATTR_PARAGON)"
              :disabled="tickedLevels.length === 0"
              @pick="setTicked(ATTR_PARAGON, $event)"
            />
          </span>
        </span>
        <UpgradeDockDivider />
        <span class="dock-group">
          <UpgradeDockLabel class="level-label">
            {{ i18n.t('app.refinement') }}
          </UpgradeDockLabel>
          <span class="dock-controls">
            <UpgradeLevelChips
              :attr-id="ATTR_REFINEMENT"
              :lit="sharedLevel(ATTR_REFINEMENT)"
              :disabled="tickedLevels.length === 0"
              @pick="setTicked(ATTR_REFINEMENT, $event)"
            />
          </span>
        </span>
        <span class="done-slot">
          <UpgradeDockChip
            text
            primary
            :tip="i18n.t('app.tooltip-stop-selecting')"
            @click="stopSelecting"
          >
            {{ i18n.t('app.done') }}
          </UpgradeDockChip>
        </span>
      </div>
    </UpgradeDock>
    <UpgradeDock v-else class="roster-dock">
      <div class="dock-rows">
        <span class="dock-group">
          <UpgradeDockLabel>{{ i18n.t('app.heroes') }}</UpgradeDockLabel>
          <span class="dock-controls">
            <UpgradeDockChip
              text
              :disabled="shownUnowned.length === 0"
              :tip="i18n.t('app.tooltip-add-all-shown')"
              @click="addShown"
            >
              {{ i18n.t('app.all') }}
            </UpgradeDockChip>
            <UpgradeDockChip
              text
              danger
              :armed="armed === 'remove-shown'"
              :disabled="shownLevels.length === 0"
              :tip="i18n.t('app.tooltip-remove-all-shown')"
              @click="removeShown"
            >
              {{ i18n.t('app.clear') }}
            </UpgradeDockChip>
            <UpgradeDockChip
              text
              :disabled="shownLevels.length === 0"
              :tip="i18n.t('app.tooltip-select-heroes')"
              @click="startSelecting"
            >
              {{ i18n.t('app.select') }}
            </UpgradeDockChip>
          </span>
        </span>
        <UpgradeDockDivider />
        <span class="dock-group">
          <UpgradeDockLabel>{{ i18n.t('app.upgrades') }}</UpgradeDockLabel>
          <span class="dock-controls">
            <UpgradeLayerChips :lit="layer" @select="layer = $event" />
            <UpgradeBulkActions
              :can-reset
              :can-raise
              @reset="editShown(() => 0)"
              @raise="editShown((level) => level + 1)"
              @max="editShown((_, attrId) => attrMax(attrId))"
            />
          </span>
        </span>
      </div>
    </UpgradeDock>
    <p class="roster-hint">
      {{ i18n.t(selecting ? 'app.rosters-select-hint' : 'app.rosters-hint') }}
    </p>

    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:mechanic-filter="mechanicFilter"
      :characters="heroes"
      :mechanic-pool="hideMechanics ? undefined : mechanicPool"
    />

    <CharacterGrid>
      <CharacterIcon
        v-for="character in filteredCharacters"
        :key="character.id"
        :character
        :dimmed="!levelsOf(character)"
        hide-tooltip
        :show-energy="energyPicked"
        inspectable
        :inspect-chips
        :tickable="selecting && !!levelsOf(character)"
        :ticked="ticked.has(character.id)"
        :locked-note="isLocked(character) ? locked?.note : undefined"
        @character-click="onPortrait"
        @mousedown="onPress(character, $event)"
        @mouseenter="onCross(character, $event)"
      >
        <!-- Reserved, not removed: revealing a pill on add would reflow the
             grid and move the next tap target. -->
        <template #badge>
          <span
            class="pill-slot"
            :class="{ ticking: selecting && levelsOf(character) }"
            @click.capture="onPillClick(character, $event)"
          >
            <UpgradePill
              :reserved="!levelsOf(character)"
              :paragon="levelsOf(character)?.[ATTR_PARAGON] ?? 0"
              :refinement="levelsOf(character)?.[ATTR_REFINEMENT] ?? 0"
              editable
              @paragon="setLevel(character, ATTR_PARAGON, $event)"
              @refinement="setLevel(character, ATTR_REFINEMENT, $event)"
            />
          </span>
        </template>
      </CharacterIcon>
    </CharacterGrid>
  </div>
</template>

<style scoped>
.roster-editor {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

.roster-dock {
  container: roster-dock / inline-size;
}

.large-dock .roster-dock {
  container-name: roster-dock-large;
}

.dock-rows {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
}

.dock-group,
.dock-controls {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.level-label {
  display: none;
}

@container roster-dock (max-width: 580px) {
  .dock-rows {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .dock-group {
    display: contents;
  }
  .dock-divider {
    display: none;
  }
}

@container roster-dock-large (max-width: 660px) {
  .dock-rows {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .dock-group {
    display: contents;
  }
  .dock-divider {
    display: none;
  }
}

@container roster-dock (max-width: 665px) {
  .select-rows {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .select-rows .dock-group {
    display: contents;
  }
  .select-rows .dock-divider {
    display: none;
  }
  .tick-controls,
  .done-slot {
    grid-row: 1;
    grid-column: 2;
  }
  .tick-controls {
    justify-self: start;
  }
  .done-slot {
    justify-self: end;
  }
  .level-label {
    display: inline;
  }
}

@container roster-dock-large (max-width: 765px) {
  .select-rows {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .select-rows .dock-group {
    display: contents;
  }
  .select-rows .dock-divider {
    display: none;
  }
  .tick-controls,
  .done-slot {
    grid-row: 1;
    grid-column: 2;
  }
  .tick-controls {
    justify-self: start;
  }
  .done-slot {
    justify-self: end;
  }
  .level-label {
    display: inline;
  }
}

.roster-dock .tick-count {
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.done-slot {
  display: inline-flex;
  margin-left: auto;
}

.pill-slot {
  display: inline-flex;
  user-select: none;
}

.pill-slot.ticking {
  cursor: pointer;
}

.pill-slot.ticking > * {
  pointer-events: none;
}

.roster-editor :deep(.character-display) {
  cursor: pointer;
}

.roster-editor.selecting :deep(.character-display.dimmed) {
  cursor: default;
  transform: none;
}

.roster-editor :deep(.character-display.locked) {
  cursor: not-allowed;
}

.roster-hint {
  margin: calc(var(--picker-row-gap) / -2) 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
