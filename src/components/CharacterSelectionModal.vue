<script setup lang="ts">
import { computed } from 'vue'

import CharacterSelectionPopup from './CharacterSelectionPopup.vue'
import { canPlaceCharacterOnTeam } from '@/lib/characters/character'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  hex: Hex
  characters: readonly CharacterType[]
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const characterStore = useCharacterStore()
const gridStore = useGridStore()

const team = computed(() => {
  const tile = gridStore.getTile(props.hex.getId())
  return getTeamFromTileState(tile.state)
})

// Heroes not already placed on this tile's team.
const availableCharacters = computed(() => {
  if (!team.value) return []
  const placedCharacterIds = characterStore
    .getTilesWithCharacters()
    .filter((tile) => tile.team === team.value)
    .map((tile) => tile.characterId)
  return props.characters.filter((char) => !placedCharacterIds.includes(char.id))
})

const handleSelect = (character: CharacterType) => {
  if (!team.value) return
  if (!canPlaceCharacterOnTeam(gridStore._getGrid(), character.id, team.value)) return
  if (characterStore.placeCharacterOnHex(props.hex.getId(), character.id, team.value)) {
    emit('close')
  }
}
</script>

<template>
  <CharacterSelectionPopup
    :characters="availableCharacters"
    :position
    @select="handleSelect"
    @close="emit('close')"
  />
</template>
