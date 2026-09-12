<script setup lang="ts">
import { computed } from 'vue'

import CharacterSelectionPalette from './CharacterSelectionPalette.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import { useGridContext } from '@/composables/useGridContext'
import { teamHasOpenSlot } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
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

const team = computed(() => getTeamFromTileState(ctx.grid.getTileById(props.hex.getId()).state))

// Heroes with a legal placement on this team. While Syn is on, an
// already-placed hero stays listed as its synergy copy, matching the roster's
// lifted grey-out.
const availableCharacters = computed(() => {
  const t = team.value
  if (!t) return []
  return props.characters.filter((char) => grids.resolvePick(ctx, char.id, t) !== null)
})

// Match the main roster's order (CharacterSelection): canonical faction order,
// placeholders trailing as one block in the faction filter icons' order.
const sortedCharacters = computed(() =>
  [...availableCharacters.value].sort(
    (a, b) =>
      (a.placeholder ? 1 : 0) - (b.placeholder ? 1 : 0) ||
      compareFaction(a.faction, b.faction) ||
      a.id - b.id,
  ),
)

/* Multi-add palette: the first pick fills the tapped tile, later picks
 * auto-place onto a free tile of the same team, and the popup stays open
 * (dismissal is mouse-leave, Esc, or an outside tap) so several heroes can be
 * placed in a row. Placed heroes drop out of the list, and a full team closes
 * the popup since every further pick would be a silent no-op. */
function handleSelect(character: CharacterType): void {
  const t = team.value
  if (!t) return
  const resolved = grids.resolvePick(ctx, character.id, t)
  if (resolved === null) return
  const anchorFree = ctx.grid.getTileById(props.hex.getId()).characterId === undefined
  const placed = anchorFree ? ctx.place(props.hex.getId(), resolved, t) : ctx.autoPlace(resolved, t)
  if (placed) {
    // Active follows interaction, matching drop routing.
    grids.setActive(ctx.id)
    if (!teamHasOpenSlot(ctx.grid, t, grids.synergy)) emit('close')
  }
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
    <CharacterSelectionPalette
      :characters="sortedCharacters"
      :enter-hint="i18n.t('app.place-hero')"
      @pick="handleSelect"
    />
  </SelectionPopup>
</template>
