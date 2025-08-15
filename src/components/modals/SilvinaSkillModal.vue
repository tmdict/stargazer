<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import GridSnippet from '../GridSnippet.vue'

interface Props {
  show: boolean
}

defineProps<Props>()
defineEmits<{
  close: []
}>()

const gridStyle = {
  numericLabel: {
    42: 1,
    39: 2,
    33: 3,
    30: 4,
    34: 5,
    40: 6,
    44: 8,
    41: 9,
    36: 10,
    29: 11,
    26: 12,
    23: 13,
    27: 14,
    31: 15,
    38: 16,
    43: 17,
    45: 18,
  },
  highlight: [9, 37],
  highlight2: [30, 33, 34, 39, 40, 42],
  highlight3: [23, 26, 27, 29, 31, 36, 38, 41, 43, 44, 45],
  character: {
    silvina: 9,
  },
  imaginaryHexes: [
    {
      relativeToHex: 45,
      direction: 'east' as const,
      label: 7,
    },
  ],
}
</script>

<template>
  <BaseModal :show="show" @close="$emit('close')">
    <h1>Silvina - First Strike</h1>
    <p>
      Silvina marks the closest enemy in a symmetrical position, flashes next to them, and launches
      an attack when a battle starts.
    </p>

    <h2>How It Works</h2>
    <p>
      Silvina first checks her symmetrical tile (the mirror position across the grid's center). If
      an enemy is there, they become the target.
    </p>
    <p>
      If the symmetrical tile is empty, Silvina searches for the nearest enemy to that position
      using an expanding clockwise spiral pattern:
    </p>
    <ul>
      <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
      <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
      <li>And so on...</li>
    </ul>
    <GridSnippet :gridStyle="gridStyle" />
    <p>
      Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally) walks
      counter-clockwise from bottom-left (180° rotation).
    </p>
    <p>(Credit: rkkñ for providing the exact algorithm for Silvina's targeting mechanics)</p>
  </BaseModal>
</template>
