<script setup lang="ts">
import { computed } from 'vue'

import CharacterSelectionPalette from './CharacterSelectionPalette.vue'
import RosterMenu from './RosterMenu.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import { useGridContext } from '@/composables/useGridContext'
import { useSelectionState } from '@/composables/useSelectionState'
import { teamHasOpenSlot } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  // The tapped tile: determines the team and where the chosen hero is placed.
  hex: Hex
  characters: readonly CharacterType[]
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
const i18n = useI18nStore()
const rosters = useRosters()
const { requestTab } = useSelectionState()

const team = computed(() => getTeamFromTileState(ctx.grid.getTileById(props.hex.getId()).state))

// Heroes the active roster offers with a legal placement on this team. While
// Syn is on, an already-placed hero stays listed as its synergy copy, matching
// the picker's lifted grey-out.
const availableCharacters = computed(() => {
  const t = team.value
  if (!t) return []
  return props.characters.filter(
    (char) => rosters.isPickable(char) && grids.resolvePick(ctx, char.id, t) !== null,
  )
})

// Match the main picker's order (CharacterSelection): canonical faction order,
// placeholders trailing as one block in the faction filter icons' order.
const sortedCharacters = computed(() =>
  [...availableCharacters.value].sort(
    (a, b) =>
      (a.placeholder ? 1 : 0) - (b.placeholder ? 1 : 0) ||
      compareFaction(a.faction, b.faction) ||
      a.id - b.id,
  ),
)

// The Rosters tab lives in the side panel, so the popup gives way to it.
const manageRosters = (): void => {
  emit('close')
  requestTab('rosters')
}

/* Multi-add palette: the first pick fills the tapped tile, later picks
 * auto-place onto a free tile of the same team, and the popup stays open
 * (dismissal is mouse-leave, Esc, or an outside tap) so several heroes can be
 * placed in a row. Placed heroes drop out of the list, and a full team closes
 * the popup since every further pick would be a silent no-op. */
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
    <RosterMenu dark manage class="popup-roster-menu" @manage="manageRosters" />
    <CharacterSelectionPalette
      :characters="sortedCharacters"
      :enter-hint="i18n.t('app.place-hero')"
      @pick="handleSelect"
    />
  </SelectionPopup>
</template>

<style scoped>
/* Lines up with the palette's search box. */
.popup-roster-menu {
  margin: 0 4px 8px;
}
</style>
