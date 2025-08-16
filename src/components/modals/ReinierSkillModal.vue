<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import GridSnippet from '../grid/GridSnippet.vue'

interface Props {
  show: boolean
}

defineProps<Props>()
defineEmits<{
  close: []
}>()

const gridStyle = {
  numericLabel: {
    4: 1,
    7: 2,
    6: 3,
    12: 4,
    13: 5,
    16: 6,
  },
  highlight: [9],
  character: {
    reinier: 9,
  },
}
</script>

<template>
  <BaseModal :show="show" :showLinkButton="true" linkParam="reinier" @close="$emit('close')">
    <h1>Reinier - Dynamic Balance</h1>
    <p>
      Reinier's Dynamic Balance skill connects an adjacent ally's position with an enemy hero if
      they're in a symmetrical position. At the start of the battle the connected ally and enemy's
      positions are swapped, the ally receives a buff and the enemy receives a debuff.
    </p>

    <h2>How It Works</h2>
    <p>
      Reinier identifies symmetrical hex pairs where one contains an ally and the other contains an
      enemy.
    </p>

    <h2>Tie-Breaking Rules</h2>
    <p>When multiple ally-enemy pairs are present, use the following rules to handle tie-break:</p>
    <ul>
      <li>
        <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left > Left >
        Bottom-right > Right > Top-left > Top-right
      </li>
      <li>
        <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right > Top-left >
        Right > Bottom-right > Left > Bottom-left (This is a 180-degree rotation of the ally
        priority)
      </li>
    </ul>

    <GridSnippet :gridStyle="gridStyle" />
  </BaseModal>
</template>
