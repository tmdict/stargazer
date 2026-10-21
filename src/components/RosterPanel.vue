<script setup lang="ts">
/* The Rosters tab: manage the roster library and edit the active roster's heroes.
   A portrait tap adds or removes the hero (removal drops its levels, as on a
   board) and its pill steps one level. The dock's add, remove and upgrade
   actions act on every hero the filters show. Select swaps the dock for a
   selection bar: portrait taps then tick heroes, and a level chip sets that
   level on every ticked hero. A mouse drag across heroes gives each the
   first hero's change, as dragging paints tiles on the map. */

import { computed, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import RosterMenu from './RosterMenu.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import HelpLink from '@/components/ui/HelpLink.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconTrash from '@/components/ui/IconTrash.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import UpgradeBulkActions from '@/components/ui/UpgradeBulkActions.vue'
import UpgradeDock from '@/components/ui/UpgradeDock.vue'
import UpgradeDockChip from '@/components/ui/UpgradeDockChip.vue'
import UpgradeDockDivider from '@/components/ui/UpgradeDockDivider.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import UpgradeLayerChips from '@/components/ui/UpgradeLayerChips.vue'
import UpgradeLevelChips from '@/components/ui/UpgradeLevelChips.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import type { AttrLayerChoice } from '@/composables/useAttrLayerSelection'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInlineRename } from '@/composables/useInlineRename'
import { useLibraryTransfer } from '@/composables/useLibraryTransfer'
import { useToast } from '@/composables/useToast'
import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  attrDefault,
  attrMax,
  UPGRADE_ATTRS,
  type AttrRecord,
} from '@/lib/characters/attributes'
import { MAX_NAME_LENGTH } from '@/lib/names'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

// Internal flex-fill + own scroll on wide screens (the Arena's height-capped
// column), as CharacterSelection does.
const { scrollable = true } = defineProps<{ scrollable?: boolean }>()

const rosters = useRosters()
const gameData = useGameDataStore()
const i18n = useI18nStore()
const { error, success } = useToast()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))
const {
  factionFilter,
  classFilter,
  mechanicFilter,
  mechanicPool,
  filteredCharacters,
  energyPicked,
  inspectChips,
} = useCharacterFilters(heroes)

// A change is applied in memory even when its write fails, so the loss is
// reported in place of any success message.
const report = (message?: string): void => {
  if (!rosters.persisted) error(i18n.t('app.rosters-not-stored'))
  else if (message) success(message)
}

const levelsOf = (character: CharacterType): AttrRecord | undefined =>
  rosters.active?.heroes[character.id]

const editHeroes = (changes: Record<string, AttrRecord | null>): void => {
  const roster = rosters.active
  if (!roster) return
  rosters.setHeroes(roster.id, changes)
  report()
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
const shownUnowned = computed(() => filteredCharacters.value.filter((c) => !levelsOf(c)))

const addShown = (): void =>
  editHeroes(Object.fromEntries(shownUnowned.value.map((c) => [c.id, {}])))

// A changed filter, roster or hero set would point an armed Clear at other
// heroes than the ones shown when it was armed.
const { armed, confirm, disarm } = useArmedConfirm()
watch([filteredCharacters, () => rosters.activeId, () => rosters.active?.heroes], disarm)
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

watch(() => rosters.activeId, stopSelecting)

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

const pills = new Map<number, Element>()
const trackPill = (id: number, pill: Element | ComponentPublicInstance | null): void => {
  if (pill) pills.set(id, (pill as ComponentPublicInstance).$el)
  else pills.delete(id)
}

const PULSE: Keyframe[] = [
  { transform: 'scale(1)' },
  {
    transform: 'scale(1.2)',
    boxShadow:
      'var(--upgrade-pill-rim), 0 0 0 4px color-mix(in srgb, var(--color-primary) 45%, transparent)',
    offset: 0.35,
  },
  {
    transform: 'scale(1)',
    boxShadow: 'var(--upgrade-pill-rim), 0 0 0 10px transparent',
  },
]
const pulse = (ids: readonly number[]): void => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  ids.forEach((id, i) =>
    pills.get(id)?.animate(PULSE, {
      duration: 600,
      delay: i * 40,
      easing: 'cubic-bezier(0.3, 1.5, 0.5, 1)',
    }),
  )
}

const setTicked = (attrId: number, level: number): void => {
  const targets = tickedLevels.value
  editLevels(targets, [attrId], () => level)
  pulse(targets.map(({ id }) => id))
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
  if (event.button !== 0) return
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
  const roster = rosters.active
  const changing = heroes.filter((c) => !!levelsOf(c) !== current.on)
  if (!roster || !changing.length) return
  rosters.setHeroes(
    roster.id,
    Object.fromEntries(changing.map(({ id }) => [id, current.on ? {} : null])),
  )
  current.edited = true
}

// A failing write shows one message however many heroes the stroke changed.
const endStroke = (current: Stroke): void => {
  current.held = false
  if (current.edited) report()
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

// ---- Library ----

const create = (): void => {
  if (!rosters.create()) error(i18n.t('app.rosters-limit'))
  else report()
}

const remove = (): void => {
  const roster = rosters.active
  if (!roster || !confirm(roster.id)) return
  rosters.remove(roster.id)
  report()
}

const {
  editingKey,
  editingName,
  setInput,
  start: startRename,
  commit: commitRename,
  cancel: cancelRename,
} = useInlineRename({
  currentName: (id) => rosters.rosters.find((r) => r.id === id)?.name,
  rename: (id, name) => {
    rosters.rename(id, name)
    report()
  },
})

// Import merges into the library and never replaces it.
const { fileInput, download, handleFileChosen } = useLibraryTransfer({
  filePrefix: 'stargazer-rosters',
  importFile: rosters.importRosters,
  report,
  messages: {
    invalid: 'app.rosters-import-invalid',
    success: 'app.rosters-import-success',
    successConflicts: 'app.rosters-import-success-conflicts',
  },
})

const {
  anchor: tipEl,
  payload: tipKey,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip<string>()
</script>

<template>
  <div v-scroll-chain class="roster-panel" :class="{ scrollable, selecting }">
    <div class="roster-bar">
      <span class="roster-info">
        <RosterMenu />
        <template v-if="rosters.active">
          <input
            v-if="editingKey === rosters.active.id"
            :ref="setInput"
            v-model="editingName"
            class="roster-name-input"
            :maxlength="MAX_NAME_LENGTH"
            :aria-label="i18n.t('app.rename')"
            @keydown.enter="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
          <button
            v-else
            type="button"
            class="rename-btn"
            :title="i18n.t('app.rename')"
            :aria-label="i18n.t('app.rename')"
            @click="startRename(rosters.active.id, rosters.active.name)"
          >
            <IconEdit :size="14" />
          </button>
        </template>
        <HelpLink class="roster-help" section="rosters" />
      </span>
      <!-- The Teams control bar's colors and order: New (danger) first, the
           library actions, the destructive Delete last. -->
      <span class="roster-actions">
        <button
          type="button"
          class="control-btn compact danger"
          :title="i18n.t('app.new')"
          @click="create"
        >
          <IconFilePlus :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.new') }}</span>
        </button>
        <button
          type="button"
          class="control-btn compact"
          :aria-label="i18n.t('app.import')"
          @click="fileInput?.click()"
          @mouseenter="showTip($event, 'app.tooltip-rosters-import')"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        >
          <IconUpload :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.import') }}</span>
        </button>
        <button
          v-if="rosters.count > 0"
          type="button"
          class="control-btn compact"
          :aria-label="i18n.t('app.export')"
          @click="download(rosters.exportRosters())"
          @mouseenter="showTip($event, 'app.tooltip-rosters-export')"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        >
          <IconDownload :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.export') }}</span>
        </button>
        <button
          v-if="rosters.active"
          type="button"
          class="control-btn compact danger"
          :class="{ armed: armed === rosters.active.id }"
          :title="armed === rosters.active.id ? i18n.t('app.confirm') : i18n.t('app.delete')"
          @click="remove"
        >
          <IconTrash :size="13" class="btn-icon" />
          <span class="btn-text">
            <ConfirmLabel :armed="armed === rosters.active.id" :label="i18n.t('app.delete')" />
          </span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="file-input"
          @change="handleFileChosen"
        />
      </span>
    </div>

    <template v-if="rosters.active">
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
        :mechanic-pool
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
                :ref="(pill) => trackPill(character.id, pill)"
                :reserved="!levelsOf(character)"
                :paragon="levelsOf(character)?.[ATTR_PARAGON] ?? 0"
                :refinement="levelsOf(character)?.[ATTR_REFINEMENT] ?? 0"
                editable
                compact
                @paragon="setLevel(character, ATTR_PARAGON, $event)"
                @refinement="setLevel(character, ATTR_REFINEMENT, $event)"
              />
            </span>
          </template>
        </CharacterIcon>
      </CharacterGrid>
    </template>

    <p v-else class="empty-state">
      {{ rosters.count === 0 ? i18n.t('app.rosters-empty') : i18n.t('app.rosters-pick') }}
    </p>

    <Teleport to="body">
      <TooltipPopup v-if="tipKey && tipEl" :target-element="tipEl" variant="detailed">
        <template #content>{{ i18n.t(tipKey) }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.roster-panel {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
  min-height: var(--panel-min-height);
}

.roster-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.roster-dock {
  container-type: inline-size;
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

@container (max-width: 490px) {
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

@container (max-width: 560px) {
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
}

@container (min-width: 561px) {
  .level-label {
    display: none;
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

@media (min-width: 769px) {
  .roster-bar {
    padding-right: var(--spacing-lg);
  }
  .roster-dock {
    margin-right: var(--spacing-lg);
  }
}

.roster-info,
.roster-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  background: none;
  border-radius: var(--radius-small);
  color: var(--color-text-secondary);
  opacity: 0.55;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.rename-btn:hover,
.rename-btn:focus-visible {
  opacity: 1;
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.roster-name-input {
  min-width: 0;
  min-height: 28px;
  font: inherit;
  font-weight: 700;
  font-size: max(0.85rem, var(--field-min-font-size));
  color: var(--color-text-primary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-medium);
  padding: 2px 8px;
  background: var(--color-bg-white);
}

.roster-name-input:focus {
  outline: none;
}

@media (max-width: 420px) {
  :is(.rename-btn, .roster-name-input) + .roster-help {
    display: none;
  }
}

.file-input {
  display: none;
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

.roster-panel :deep(.character-display) {
  cursor: pointer;
}

.roster-panel.selecting :deep(.character-display.dimmed) {
  cursor: default;
  transform: none;
}

.roster-hint {
  margin: calc(var(--spacing-sm) - var(--spacing-lg)) 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.empty-state {
  border: 2px dashed var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

@media (max-width: 768px) {
  .roster-panel {
    padding: 0 var(--spacing-lg);
  }
  .roster-name-input {
    min-height: 34px;
  }
}

@media (min-width: 1220px) {
  .roster-panel.scrollable {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>
