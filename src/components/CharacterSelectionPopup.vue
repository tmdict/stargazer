<script setup lang="ts">
import { computed } from 'vue'

import CharacterSelectionPalette from './CharacterSelectionPalette.vue'
import RosterMenu from './RosterMenu.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import UpgradeBars from './ui/UpgradeBars.vue'
import { useDuelList } from '@/composables/useDuelList'
import { useDuelTrialGroups } from '@/composables/useDuelTrialGroups'
import { useGridContext } from '@/composables/useGridContext'
import { useSelectionState } from '@/composables/useSelectionState'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { teamHasOpenSlot } from '@/lib/characters/character'
import { compareCharacters } from '@/lib/filterOrder'
import { duelHeroes, duelPickBackdrop, duelTrialPool } from '@/lib/hd/heroes'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { getTeamFromTileState } from '@/lib/types/state'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

interface Props {
  // The tapped tile: determines the team and where the chosen hero is placed.
  hex: Hex
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// The board that opened the popup (injected through GridManager, which
// declares this component, so Teleport doesn't break it). Picks must resolve
// against this board, not the page-wide active board, which any interaction
// on another board can move while the popup is open.
const ctx = useGridContext()
const grids = useGrids()
const gameData = useGameDataStore()
const i18n = useI18nStore()
const rosters = useRosters()
const { requestTab } = useSelectionState()

const team = computed(() => getTeamFromTileState(ctx.grid.getTileById(props.hex.getId()).state))

// An Honor Duel board draws on the mode's units, the same for every player,
// and holds no roster levels. Its pool follows the list its picker shows: the
// shop's heroes, or each Trial unit once, at the cheapest card that brings it.
const duel = computed(() => ctx.kind === 'honorDuel')
const trialGroups = useDuelTrialGroups()
const trialList = useDuelList()
const pool = computed(() => {
  if (!duel.value) return gameData.characters.filter(rosters.isPickable)
  return trialList.value ? duelTrialPool(trialGroups.value) : duelHeroes(gameData.characters)
})

// Heroes of the pool with a legal placement on this team. While Syn is on, an
// already-placed hero stays listed as its synergy copy, matching the picker's
// lifted grey-out.
const availableCharacters = computed(() => {
  const t = team.value
  if (!t) return []
  return pool.value.filter((char) => grids.resolvePick(ctx, char.id, t) !== null)
})

const sortedCharacters = computed(() => [...availableCharacters.value].sort(compareCharacters))

// The Rosters tab lives in the side panel, so the popup gives way to it.
const manageRosters = (): void => {
  emit('close')
  requestTab('rosters')
}

/* Multi-add palette: the first pick fills the tapped tile, later picks
 * auto-place onto a free tile of the same team, and the popup stays open
 * (dismissal is mouse-leave, Esc, or an outside tap) so several heroes can be
 * placed in a row. A placed hero drops out of the list, while a Trial unit
 * stays for another copy, and a full team closes the popup since every further
 * pick would be a silent no-op. */
function handleSelect(character: CharacterType): void {
  const t = team.value
  if (!t) return
  const anchorFree = ctx.grid.getTileById(props.hex.getId()).characterId === undefined
  const placed = grids.placePick(ctx, character.id, t, anchorFree ? props.hex.getId() : undefined)
  if (placed) {
    // Active follows interaction, matching drop routing.
    grids.setActive(ctx.id)
    if (!teamHasOpenSlot(ctx.grid, t, grids.synergy)) emit('close')
  }
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
    <RosterMenu v-if="!duel" dark manage class="popup-roster-menu" @manage="manageRosters" />
    <CharacterSelectionPalette
      :characters="sortedCharacters"
      :enter-hint="i18n.t('app.place-hero')"
      :backdrop-of="duel ? duelPickBackdrop : undefined"
      touch-focus
      @pick="handleSelect"
    >
      <template v-if="rosters.active && !duel" #badge="{ character }">
        <UpgradeBars
          :reserved="!rosters.levelsFor(character.id)"
          :paragon="rosters.levelsFor(character.id)?.[ATTR_PARAGON] ?? 0"
          :refinement="rosters.levelsFor(character.id)?.[ATTR_REFINEMENT] ?? 0"
        />
      </template>
    </CharacterSelectionPalette>
  </SelectionPopup>
</template>

<style scoped>
.popup-roster-menu {
  margin: 0 var(--palette-inset) 8px;
}
</style>
