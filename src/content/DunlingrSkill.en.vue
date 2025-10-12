<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Dunlingr · Skills',
  description:
    'Dunlingr summons the Bell of Order, which targets the ally furthest from his current position at the start of the battle. Depending on which mode the Bell is set to, the following effects will apply to all characters on the field other than the targeted ally',
  url: 'skill/dunlingr',
  locale: 'en',
  keywords: ['Dunlingr', '顿里尔'],
})
</script>

<template>
  <article>
    <h1>Dunlingr</h1>

    <h2>Echo of Silence</h2>
    <p>
      Dunlingr summons the Bell of Order before a battle starts, which targets the ally furthest
      from his current position. Depending on which mode the Bell is set to, the following effects
      will apply to all characters on the field other than the targeted ally:
    </p>
    <ul>
      <li>Spellbind: Unable to cast Ultimate.</li>
      <li>Curelock: Unable to recover HP for others.</li>
    </ul>

    <h3>How It Works</h3>
    <p>
      Dunlingr automatically identifies and targets a character on his own team that is furthest
      away from his current tile.
    </p>
    <p>
      Distance calculation uses hexagonal grid distance to determine the furthest teammate. Dunlingr
      cannot target himself.
    </p>
    <p>When multiple teammates have the same distance:</p>
    <ul>
      <li><strong>Ally Team Dunlingr:</strong> Prefers the ally with the lower hex ID</li>
      <li>
        <strong>Enemy Team Dunlingr:</strong> Prefers the teammate with the higher hex ID (180°
        rotation)
      </li>
    </ul>
  </article>
</template>
