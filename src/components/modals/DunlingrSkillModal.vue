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
  <BaseModal :show="show" :showLinkButton="true" linkParam="dunlingr" @close="$emit('close')">
    <h1>Dunlingr - Bell of Order</h1>
    <p>
      Dunlingr's Bell of Order skill targets an ally character on his team. Depending on which mode
      the Bell is set to, the following effects will apply to all characters on the field other than
      the targeted ally:
    </p>
    <ul>
      <li>Spellbind: Unable to cast Ultimate.</li>
      <li>Curelock: Unable to recover HP for others.</li>
    </ul>

    <h2>How It Works</h2>
    <p>
      Dunlingr automatically identifies and targets a character on his own team that is furthest
      away from his current tile.
    </p>
    <p>
      Distance calculation uses hexagonal grid distance to determine the furthest teammate. Dunlingr
      cannot target himself.
    </p>

    <h2>Tie-Breaking Rules</h2>
    <p>When multiple teammates are equidistant at maximum range:</p>
    <ul>
      <li><strong>Ally Team Dunlingr:</strong> Prefers the ally with the lower hex ID</li>
      <li>
        <strong>Enemy Team Dunlingr:</strong> Prefers the teammate with the higher hex ID (180°
        rotation)
      </li>
    </ul>
  </BaseModal>
</template>
