<script setup lang="ts">
import BaseModal from './BaseModal.vue'

interface Props {
  show: boolean
}

defineProps<Props>()
defineEmits<{
  close: []
}>()
</script>

<template>
  <BaseModal :show="show" :showLinkButton="true" linkParam="vala" @close="$emit('close')">
    <h1>Vala - Notice Beforehand</h1>
    <p>Vala's Notice Beforehand skill targets the enemy furthest from her current position.</p>

    <h2>How It Works</h2>
    <p>
      Vala automatically identifies and targets an opposing team's character that is furthest away
      from her current tile.
    </p>
    <p>Distance calculation uses hexagonal grid distance to determine the furthest enemy.</p>

    <h2>Tie-Breaking Rules</h2>
    <p>When multiple enemies are equidistant at maximum range:</p>
    <ul>
      <li><strong>Ally Team Vala:</strong> Prefers the enemy with the lower hex ID</li>
      <li>
        <strong>Enemy Team Vala:</strong> Prefers the enemy with the higher hex ID (180° rotation)
      </li>
    </ul>
  </BaseModal>
</template>
